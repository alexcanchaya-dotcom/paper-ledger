import {
  FY_MONTHS,
  type ExtraRevenue,
  type FixedAsset,
  type FyStartMonth,
  type LedgerState,
  type Settings,
  type Student,
  type TaxAdjustments,
} from "./types";

export function zeros(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

export function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

function startMonthOf(settings: Settings | FyStartMonth | undefined): FyStartMonth {
  if (settings === 0 || settings === 3) return settings;
  if (settings && typeof settings === "object") return settings.fyStartMonth ?? 3;
  return 3;
}

export function fyRange(
  fyStartYear: number,
  fyStartMonth: FyStartMonth = 3,
): { start: Date; end: Date } {
  return {
    start: new Date(fyStartYear, fyStartMonth, 1),
    end: new Date(fyStartYear + 1, fyStartMonth, 0, 23, 59, 59),
  };
}

export function monthBounds(
  fyStartYear: number,
  monthIndex: number,
  fyStartMonth: FyStartMonth = 3,
): { start: Date; end: Date } {
  const abs = fyStartMonth + monthIndex;
  const month = abs % 12;
  const year = fyStartYear + Math.floor(abs / 12);
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);
  return { start, end };
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function familyKey(student: Pick<Student, "familyName" | "id">): string {
  return student.familyName.trim().toLowerCase() || student.id;
}

export function defaultFeeFor(
  settings: Pick<Settings, "defaultMathFee" | "defaultEnglishFee">,
  subjectId: string,
): number {
  if (subjectId === "english") return settings.defaultEnglishFee || settings.defaultMathFee || 0;
  return settings.defaultMathFee || 0;
}

export function subjectFee(
  student: Pick<Student, "feePerSubject"> & { feeBySubject?: Record<string, number> },
  subjectId: string,
): number {
  const mapped = student.feeBySubject?.[subjectId];
  if (typeof mapped === "number" && Number.isFinite(mapped)) return mapped;
  return student.feePerSubject || 0;
}

export function studentGross(
  student: Pick<Student, "feePerSubject" | "subjects"> & { feeBySubject?: Record<string, number> },
): number {
  const ids = student.subjects.length ? student.subjects : ["_"];
  return ids.reduce((sum, id) => sum + subjectFee(student, id), 0);
}

export function isStudentActiveInMonth(
  student: Student,
  fyStartYear: number,
  monthIndex: number,
  fyStartMonth: FyStartMonth = 3,
): boolean {
  if (student.status === "left" || student.status === "paused" || student.status === "waiting") {
    return false;
  }
  const { start, end } = monthBounds(fyStartYear, monthIndex, fyStartMonth);
  if (student.status === "returning") {
    if (!student.restartOn) return false;
    const restart = parseDate(student.restartOn);
    if (restart > end) return false;
  } else if (student.status !== "active") {
    return false;
  }
  const from = parseDate(student.enrolledFrom);
  if (from > end) return false;
  if (student.enrolledTo) {
    const to = parseDate(student.enrolledTo);
    if (to < start) return false;
  }
  return true;
}

export interface MonthEnrolment {
  gross: number;
  discount: number;
  net: number;
  studentCount: number;
  subjectCount: number;
  siblingCount: number;
}

export function enrolmentForMonth(
  students: Student[],
  settings: Settings,
  monthIndex: number,
): MonthEnrolment {
  const fyStartMonth = startMonthOf(settings);
  const active = students.filter((s) =>
    isStudentActiveInMonth(s, settings.fyStartYear, monthIndex, fyStartMonth),
  );

  const byFamily = new Map<string, Student[]>();
  for (const s of active) {
    const key = familyKey(s);
    const list = byFamily.get(key) ?? [];
    list.push(s);
    byFamily.set(key, list);
  }

  let gross = 0;
  let discount = 0;
  let subjectCount = 0;
  let siblingCount = 0;

  for (const members of byFamily.values()) {
    const familyHasSiblings = members.length >= 2;
    for (const s of members) {
      const subjects = Math.max(1, s.subjects.length);
      const fee = studentGross(s);
      gross += fee;
      subjectCount += subjects;
      const getsDiscount = familyHasSiblings && !s.isPrimaryInFamily;
      if (getsDiscount) {
        discount += fee * (settings.siblingDiscountPct / 100);
        siblingCount += 1;
      }
    }
  }

  return {
    gross,
    discount,
    net: gross - discount,
    studentCount: active.length,
    subjectCount,
    siblingCount,
  };
}

export function tuitionSeries(state: LedgerState): {
  gross: number[];
  discount: number[];
  net: number[];
  enrolment: MonthEnrolment[];
} {
  const enrolment = FY_MONTHS.map((_, i) =>
    enrolmentForMonth(state.students, state.settings, i),
  );
  const gross = enrolment.map((e, i) => state.tuitionOverrides[i] ?? e.gross);
  const discount = enrolment.map((e, i) => state.discountOverrides[i] ?? e.discount);
  const net = gross.map((g, i) => g - discount[i]);
  return { gross, discount, net, enrolment };
}

export function licenseFeeSeries(state: LedgerState): number[] {
  const { gross, net, enrolment } = tuitionSeries(state);
  const { licenseFeeMode, licenseFeeRate, licenseFeeBase } = state.settings;
  return FY_MONTHS.map((_, i) => {
    if (licenseFeeMode === "per_subject") {
      return enrolment[i].subjectCount * licenseFeeRate;
    }
    // Percent of each billed subject's fee. Gross = that sum; net is after family discount.
    const base = licenseFeeBase === "net" ? net[i] : gross[i];
    return (base * licenseFeeRate) / 100;
  });
}

export const royaltySeries = licenseFeeSeries;

export function initialLicenseSeries(state: LedgerState): number[] {
  const values = state.initialLicenseValues ?? zeros();
  return Array.from({ length: 12 }, (_, i) => values[i] ?? 0);
}

export function monthsOwnedInFy(
  asset: FixedAsset,
  fyStartYear: number,
  fyStartMonth: FyStartMonth = 3,
): number[] {
  const purchased = parseDate(asset.purchaseDate);
  const lifeMonths = Math.max(1, Math.round(asset.usefulLifeYears * 12));
  const flags = zeros();
  for (let i = 0; i < 12; i++) {
    const { end } = monthBounds(fyStartYear, i, fyStartMonth);
    if (purchased > end) continue;
    const monthsSincePurchase =
      (end.getFullYear() - purchased.getFullYear()) * 12 +
      (end.getMonth() - purchased.getMonth()) +
      1;
    if (monthsSincePurchase > 0 && monthsSincePurchase <= lifeMonths) {
      flags[i] = 1;
    }
  }
  return flags;
}

export function monthlyBookAmort(asset: FixedAsset): number {
  const lifeMonths = Math.max(1, Math.round(asset.usefulLifeYears * 12));
  const depreciable = Math.max(0, asset.cost - asset.residualValue);
  return depreciable / lifeMonths;
}

export function amortisationSeries(
  assets: FixedAsset[],
  fyStartYear: number,
  fyStartMonth: FyStartMonth = 3,
): number[] {
  const series = zeros();
  for (const asset of assets) {
    const monthly = monthlyBookAmort(asset);
    const owned = monthsOwnedInFy(asset, fyStartYear, fyStartMonth);
    for (let i = 0; i < 12; i++) series[i] += owned[i] * monthly;
  }
  return series;
}

export function accumulatedAmortToFyStart(
  asset: FixedAsset,
  fyStartYear: number,
  fyStartMonth: FyStartMonth = 3,
): number {
  const purchased = parseDate(asset.purchaseDate);
  const fyStart = new Date(fyStartYear, fyStartMonth, 1);
  if (purchased >= fyStart) return 0;
  const months =
    (fyStart.getFullYear() - purchased.getFullYear()) * 12 +
    (fyStart.getMonth() - purchased.getMonth());
  const lifeMonths = Math.max(1, Math.round(asset.usefulLifeYears * 12));
  const elapsed = Math.min(lifeMonths, Math.max(0, months));
  return elapsed * monthlyBookAmort(asset);
}

export function assetPosition(
  asset: FixedAsset,
  fyStartYear: number,
  fyStartMonth: FyStartMonth = 3,
) {
  const monthly = monthlyBookAmort(asset);
  const owned = monthsOwnedInFy(asset, fyStartYear, fyStartMonth);
  const yearCharge = owned.reduce((a, f) => a + f * monthly, 0);
  const openingAccum = accumulatedAmortToFyStart(asset, fyStartYear, fyStartMonth);
  const closingAccum = Math.min(
    Math.max(0, asset.cost - asset.residualValue),
    openingAccum + yearCharge,
  );
  const nbv = Math.max(0, asset.cost - closingAccum);
  return { monthly, yearCharge, openingAccum, closingAccum, nbv, monthsCharged: sum(owned) };
}

export function taxDepreciationForAsset(
  asset: FixedAsset,
  fyStartYear: number,
  fyStartMonth: FyStartMonth = 3,
): { depreciation: number; closingWdv: number; halfRate: boolean } {
  const { start, end } = fyRange(fyStartYear, fyStartMonth);
  const purchased = parseDate(asset.purchaseDate);
  if (purchased > end) return { depreciation: 0, closingWdv: asset.taxOpeningWdv, halfRate: false };

  const opening = purchased >= start ? asset.cost : asset.taxOpeningWdv;
  const usedStart = purchased > start ? purchased : start;
  const daysUsed = Math.floor((end.getTime() - usedStart.getTime()) / 86_400_000) + 1;
  const halfRate = purchased >= start && daysUsed < 180;
  const rate = (asset.taxWdvRatePct / 100) * (halfRate ? 0.5 : 1);
  const depreciation = opening * rate;
  return {
    depreciation,
    closingWdv: Math.max(0, opening - depreciation),
    halfRate,
  };
}

export interface MonthPnL {
  grossTuition: number;
  siblingDiscount: number;
  registration: number;
  materials: number;
  otherIncome: number;
  netRevenue: number;
  licenseFee: number;
  initialLicense: number;
  operatingExpenses: { id: string; name: string; amount: number }[];
  amortisation: number;
  totalCosts: number;
  operatingProfit: number;
}

export function monthPnL(state: LedgerState, monthIndex: number): MonthPnL {
  const tuition = tuitionSeries(state);
  const extra: ExtraRevenue = state.extraRevenue;
  const license = licenseFeeSeries(state);
  const initialLicense = initialLicenseSeries(state)[monthIndex] ?? 0;
  const amort = amortisationSeries(
    state.assets,
    state.settings.fyStartYear,
    startMonthOf(state.settings),
  );
  const grossTuition = tuition.gross[monthIndex];
  const siblingDiscount = tuition.discount[monthIndex];
  const registration = extra.registration[monthIndex] ?? 0;
  const materials = extra.materials[monthIndex] ?? 0;
  const otherIncome = extra.other[monthIndex] ?? 0;
  const netRevenue = tuition.net[monthIndex] + registration + materials + otherIncome;
  const licenseFee = license[monthIndex];
  const operatingExpenses = state.expenses.map((row) => ({
    id: row.id,
    name: row.name,
    amount: row.values[monthIndex] ?? 0,
  }));
  const amortisation = amort[monthIndex];
  const totalCosts =
    initialLicense +
    licenseFee +
    operatingExpenses.reduce((a, r) => r.amount + a, 0) +
    amortisation;
  return {
    grossTuition,
    siblingDiscount,
    registration,
    materials,
    otherIncome,
    netRevenue,
    licenseFee,
    initialLicense,
    operatingExpenses,
    amortisation,
    totalCosts,
    operatingProfit: netRevenue - totalCosts,
  };
}

export function yearPnL(state: LedgerState): MonthPnL {
  return pnlThrough(state, 11);
}

export function pnlThrough(state: LedgerState, throughMonth: number): MonthPnL {
  const last = Math.max(0, Math.min(11, throughMonth));
  const months = Array.from({ length: last + 1 }, (_, i) => monthPnL(state, i));
  const add = (pick: (m: MonthPnL) => number) => sum(months.map(pick));
  const expenseIds = state.expenses.map((r) => r.id);
  return {
    grossTuition: add((m) => m.grossTuition),
    siblingDiscount: add((m) => m.siblingDiscount),
    registration: add((m) => m.registration),
    materials: add((m) => m.materials),
    otherIncome: add((m) => m.otherIncome),
    netRevenue: add((m) => m.netRevenue),
    licenseFee: add((m) => m.licenseFee),
    initialLicense: add((m) => m.initialLicense),
    operatingExpenses: expenseIds.map((id, idx) => ({
      id,
      name: state.expenses[idx].name,
      amount: add((m) => m.operatingExpenses.find((e) => e.id === id)?.amount ?? 0),
    })),
    amortisation: add((m) => m.amortisation),
    totalCosts: add((m) => m.totalCosts),
    operatingProfit: add((m) => m.operatingProfit),
  };
}

export interface TaxComputation {
  profitBeforeTax: number;
  bookAmortisation: number;
  disallowed: number;
  taxDepreciation: number;
  otherDeductions: number;
  taxableIncome: number;
  incomeTax: number;
  cess: number;
  totalTax: number;
  advanceTax: number;
  tds: number;
  taxPayable: number;
  assetTax: {
    id: string;
    name: string;
    opening: number;
    depreciation: number;
    closing: number;
    halfRate: boolean;
  }[];
}

export function computeTax(state: LedgerState, tax: TaxAdjustments = state.tax): TaxComputation {
  const y = yearPnL(state);
  const fyStartMonth = startMonthOf(state.settings);
  const assetTax = state.assets.map((asset) => {
    const purchased = new Date(asset.purchaseDate);
    const fyStart = new Date(state.settings.fyStartYear, fyStartMonth, 1);
    const opening = purchased >= fyStart ? asset.cost : asset.taxOpeningWdv;
    const t = taxDepreciationForAsset(asset, state.settings.fyStartYear, fyStartMonth);
    return {
      id: asset.id,
      name: asset.name,
      opening,
      depreciation: t.depreciation,
      closing: t.closingWdv,
      halfRate: t.halfRate,
    };
  });
  const bookAmortisation = y.amortisation;
  const disallowed = sum(tax.disallowed.map((l) => l.amount));
  const taxDepreciation = sum(assetTax.map((a) => a.depreciation));
  const otherDeductions = sum(tax.deductions.map((l) => l.amount));
  const profitBeforeTax = y.operatingProfit;
  const taxableIncome =
    profitBeforeTax + disallowed + bookAmortisation - taxDepreciation - otherDeductions;
  const chargeable = Math.max(0, taxableIncome);
  const incomeTax = (chargeable * state.settings.taxRatePct) / 100;
  const cess = (incomeTax * state.settings.cessPct) / 100;
  const totalTax = incomeTax + cess;
  return {
    profitBeforeTax,
    bookAmortisation,
    disallowed,
    taxDepreciation,
    otherDeductions,
    taxableIncome,
    incomeTax,
    cess,
    totalTax,
    advanceTax: tax.advanceTax,
    tds: tax.tds,
    taxPayable: totalTax - tax.advanceTax - tax.tds,
    assetTax,
  };
}

export function currentFyMonthIndex(
  now = new Date(),
  fyStartYear?: number,
  fyStartMonth: FyStartMonth = 3,
): number {
  const year =
    fyStartYear ??
    (now.getMonth() >= fyStartMonth ? now.getFullYear() : now.getFullYear() - 1);
  const { start, end } = fyRange(year, fyStartMonth);
  if (now < start) return 0;
  if (now > end) return 11;
  return (now.getFullYear() - year) * 12 + now.getMonth() - fyStartMonth;
}

export { FY_MONTHS };
