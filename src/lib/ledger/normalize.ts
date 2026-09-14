import { zeros } from "./calc";
import { kitOf } from "./kits";
import type {
  CurrencyCode,
  ExtraRevenue,
  FyStartMonth,
  LedgerState,
  Settings,
  Student,
  TradeId,
} from "./types";

const CURRENCIES: CurrencyCode[] = ["INR", "USD", "GBP", "AUD", "SGD", "EUR"];
const TRADES: TradeId[] = ["tuition", "salon", "studio", "services", "cafe", "shop"];

function asTrade(value: unknown): TradeId {
  return TRADES.includes(value as TradeId) ? (value as TradeId) : "tuition";
}

function asCurrency(value: unknown): CurrencyCode {
  return CURRENCIES.includes(value as CurrencyCode) ? (value as CurrencyCode) : "EUR";
}

function asFyStart(value: unknown, trade: TradeId): FyStartMonth {
  if (value === 0 || value === 3) return value;
  return trade === "tuition" ? 3 : 0;
}

function pad12(values: number[] | undefined, fill = 0): number[] {
  const next = Array.from({ length: 12 }, () => fill);
  (values ?? []).slice(0, 12).forEach((v, i) => {
    next[i] = typeof v === "number" && Number.isFinite(v) ? v : fill;
  });
  return next;
}

function padNulls(values: (number | null)[] | undefined): (number | null)[] {
  const next = Array.from({ length: 12 }, () => null as number | null);
  (values ?? []).slice(0, 12).forEach((v, i) => {
    next[i] = typeof v === "number" && Number.isFinite(v) ? v : v === null ? null : null;
  });
  return next;
}

function extra(raw?: Partial<ExtraRevenue> | null): ExtraRevenue {
  return {
    registration: pad12(raw?.registration),
    materials: pad12(raw?.materials),
    other: pad12(raw?.other),
  };
}

export function normalizeStudent(raw: Partial<Student>, fallbackFee: number): Student {
  const subjects = Array.isArray(raw.subjects) && raw.subjects.length ? raw.subjects.map(String) : ["math"];
  const feePerSubject =
    typeof raw.feePerSubject === "number" && Number.isFinite(raw.feePerSubject)
      ? raw.feePerSubject
      : fallbackFee;
  const feeBySubject: Record<string, number> = { ...(raw.feeBySubject ?? {}) };
  for (const id of subjects) {
    if (typeof feeBySubject[id] !== "number" || !Number.isFinite(feeBySubject[id])) {
      feeBySubject[id] = feePerSubject;
    }
  }
  const status =
    raw.status === "paused" ||
    raw.status === "left" ||
    raw.status === "waiting" ||
    raw.status === "returning"
      ? raw.status
      : "active";
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((t) => String(t).trim()).filter(Boolean)
    : String(raw.notes ?? "")
        .split("#")
        .slice(1)
        .map((t) => t.split(/\s/)[0] ?? "")
        .filter(Boolean);
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    familyName: String(raw.familyName ?? ""),
    isPrimaryInFamily: raw.isPrimaryInFamily !== false,
    subjects,
    feePerSubject,
    feeBySubject,
    levelBySubject: raw.levelBySubject && typeof raw.levelBySubject === "object" ? { ...raw.levelBySubject } : {},
    daysPerWeek:
      typeof raw.daysPerWeek === "number" && raw.daysPerWeek > 0 ? Math.min(7, Math.round(raw.daysPerWeek)) : 2,
    status,
    enrolledFrom: String(raw.enrolledFrom ?? new Date().toISOString().slice(0, 10)),
    enrolledTo: raw.enrolledTo ? String(raw.enrolledTo) : null,
    restartOn: raw.restartOn ? String(raw.restartOn) : null,
    notes: String(raw.notes ?? ""),
    tags,
    parentName: String(raw.parentName ?? ""),
    parentPhone: String(raw.parentPhone ?? ""),
    parentEmail: String(raw.parentEmail ?? ""),
    renewalOn: raw.renewalOn ? String(raw.renewalOn) : null,
    lastParentCall: raw.lastParentCall ? String(raw.lastParentCall) : null,
    lastPaidOn: raw.lastPaidOn ? String(raw.lastPaidOn) : null,
    arrears: Boolean(raw.arrears),
    awayForSummer: Boolean(raw.awayForSummer),
    source: String(raw.source ?? ""),
    goalDate: raw.goalDate ? String(raw.goalDate) : null,
  };
}

export function normalizeSettings(raw: Partial<Settings> | undefined): Settings {
  const tradeId = asTrade(raw?.tradeId);
  const kit = kitOf(tradeId);
  const fyStartMonth = asFyStart(raw?.fyStartMonth, tradeId);
  return {
    centreName: String(raw?.centreName ?? ""),
    instructorName: String(raw?.instructorName ?? ""),
    city: String(raw?.city ?? ""),
    fyStartYear: Number(raw?.fyStartYear) || new Date().getFullYear(),
    fyStartMonth,
    currency: asCurrency(raw?.currency),
    licenseFeeMode: raw?.licenseFeeMode === "per_subject" ? "per_subject" : "percent",
    licenseFeeRate: Number(raw?.licenseFeeRate) || 0,
    licenseFeeBase: raw?.licenseFeeBase === "net" ? "net" : "gross",
    siblingDiscountPct: Number(raw?.siblingDiscountPct) || 0,
    taxRatePct: Number(raw?.taxRatePct) || 0,
    cessPct: Number(raw?.cessPct) || 0,
    defaultMathFee: Number(raw?.defaultMathFee) || kit.defaultFee,
    defaultEnglishFee: Number(raw?.defaultEnglishFee) || kit.defaultFee,
    renewalNoticeDays: Number(raw?.renewalNoticeDays) || 45,
    summerReturnDate: String(raw?.summerReturnDate ?? `${Number(raw?.fyStartYear) || 2026}-09-01`),
    paymentGraceDays: Number(raw?.paymentGraceDays) || 35,
    tradeId,
    onboarded: raw?.onboarded !== false,
    offerings:
      Array.isArray(raw?.offerings) && raw.offerings.length
        ? raw.offerings.map((o) => ({ id: String(o.id), label: String(o.label || o.id) }))
        : kit.offerings,
    isSample: Boolean(raw?.isSample),
    lastBackupAt: raw?.lastBackupAt ? String(raw.lastBackupAt) : null,
  };
}

export function normalizeLedger(raw: Partial<LedgerState> | null | undefined): LedgerState {
  const settings = normalizeSettings(raw?.settings);
  const fee = settings.defaultMathFee;
  return {
    settings,
    students: Array.isArray(raw?.students) ? raw.students.map((s) => normalizeStudent(s, fee)) : [],
    extraRevenue: extra(raw?.extraRevenue),
    initialLicenseValues: pad12(raw?.initialLicenseValues),
    tuitionOverrides: padNulls(raw?.tuitionOverrides),
    discountOverrides: padNulls(raw?.discountOverrides),
    expenses: Array.isArray(raw?.expenses)
      ? raw.expenses.map((row) => ({
          ...row,
          values: pad12(row.values),
        }))
      : [],
    assets: Array.isArray(raw?.assets) ? raw.assets : [],
    tax: raw?.tax ?? {
      disallowed: [],
      deductions: [],
      advanceTax: 0,
      tds: 0,
    },
    tasks: Array.isArray(raw?.tasks) ? raw.tasks : [],
    doneReminderKeys: Array.isArray(raw?.doneReminderKeys) ? raw.doneReminderKeys : [],
  };
}

export function emptyExtra(): ExtraRevenue {
  return { registration: zeros(), materials: zeros(), other: zeros() };
}
