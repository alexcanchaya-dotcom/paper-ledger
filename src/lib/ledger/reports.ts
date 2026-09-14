import {
  currentFyMonthIndex,
  enrolmentForMonth,
  familyKey,
  isStudentActiveInMonth,
  licenseFeeSeries,
  monthBounds,
  monthPnL,
  pnlThrough,
  studentGross,
  subjectFee,
} from "./calc";
import { kitOf, offeringLabel } from "./kits";
import { buildDesk } from "./reminders";
import type { LedgerState, StudentStatus } from "./types";

export interface MixRow {
  id: string;
  label: string;
  count: number;
  revenue: number;
}

export interface Census {
  active: number;
  waiting: number;
  paused: number;
  returning: number;
  left: number;
  away: number;
  families: number;
  dualSubject: number;
  billedThisMonth: number;
  subjectCount: number;
  siblingCount: number;
  monthlyGross: number;
  monthlyNet: number;
}

export interface MomDelta {
  monthIndex: number;
  prevIndex: number | null;
  revenue: number;
  revenueDelta: number | null;
  revenuePct: number | null;
  profit: number;
  profitDelta: number | null;
  enrol: number;
  enrolDelta: number | null;
}

export interface RoyaltyReport {
  rate: number;
  mode: string;
  thisMonth: number;
  ytd: number;
  remainingMonths: number;
  keepPct: number;
}

export interface BackupHealth {
  lastBackupAt: string | null;
  days: number | null;
  stale: boolean;
}

function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y) return null;
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function census(state: LedgerState, monthIndex?: number): Census {
  const fyStartMonth = state.settings.fyStartMonth ?? 3;
  const idx =
    monthIndex ??
    currentFyMonthIndex(new Date(), state.settings.fyStartYear, fyStartMonth);
  const enrol = enrolmentForMonth(state.students, state.settings, idx);
  const families = new Set(
    state.students
      .filter((s) => s.status === "active")
      .map((s) => familyKey(s)),
  );
  const count = (status: StudentStatus) =>
    state.students.filter((s) => s.status === status).length;
  return {
    active: count("active"),
    waiting: count("waiting"),
    paused: count("paused"),
    returning: count("returning"),
    left: count("left"),
    away: state.students.filter((s) => s.awayForSummer && s.status === "active").length,
    families: families.size,
    dualSubject: state.students.filter((s) => s.status === "active" && s.subjects.length > 1)
      .length,
    billedThisMonth: enrol.studentCount,
    subjectCount: enrol.subjectCount,
    siblingCount: enrol.siblingCount,
    monthlyGross: enrol.gross,
    monthlyNet: enrol.net,
  };
}

export function subjectMix(state: LedgerState, monthIndex?: number): MixRow[] {
  const fyStartMonth = state.settings.fyStartMonth ?? 3;
  const idx =
    monthIndex ??
    currentFyMonthIndex(new Date(), state.settings.fyStartYear, fyStartMonth);
  const offerings = state.settings.offerings?.length
    ? state.settings.offerings
    : kitOf(state.settings.tradeId).offerings;
  const map = new Map<string, MixRow>();
  for (const o of offerings) {
    map.set(o.id, { id: o.id, label: o.label, count: 0, revenue: 0 });
  }
  for (const s of state.students) {
    if (!isStudentActiveInMonth(s, state.settings.fyStartYear, idx, fyStartMonth)) continue;
    for (const id of s.subjects) {
      const row = map.get(id) ?? {
        id,
        label: offeringLabel(state.settings, id),
        count: 0,
        revenue: 0,
      };
      row.count += 1;
      row.revenue += subjectFee(s, id);
      map.set(id, row);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue || b.count - a.count);
}

export function levelMix(state: LedgerState): MixRow[] {
  const map = new Map<string, MixRow>();
  for (const s of state.students) {
    if (s.status === "left") continue;
    const levels = Object.values(s.levelBySubject ?? {}).filter(Boolean);
    if (!levels.length) continue;
    for (const level of levels) {
      const row = map.get(level) ?? { id: level, label: level, count: 0, revenue: 0 };
      row.count += 1;
      map.set(level, row);
    }
  }
  const order = new Map(
    [
      "6A",
      "5A",
      "4A",
      "3A",
      "2A",
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "O",
    ].map((l, i) => [l, i]),
  );
  return [...map.values()].sort(
    (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99) || b.count - a.count,
  );
}

export function monthOverMonth(state: LedgerState, now = new Date()): MomDelta {
  const fyStartMonth = state.settings.fyStartMonth ?? 3;
  const monthIndex = currentFyMonthIndex(now, state.settings.fyStartYear, fyStartMonth);
  const thisM = monthPnL(state, monthIndex);
  const prevIndex = monthIndex > 0 ? monthIndex - 1 : null;
  const prev = prevIndex == null ? null : monthPnL(state, prevIndex);
  const enrol = enrolmentForMonth(state.students, state.settings, monthIndex);
  const prevEnrol =
    prevIndex == null ? null : enrolmentForMonth(state.students, state.settings, prevIndex);
  const pct = (nowV: number, thenV: number) => (thenV === 0 ? null : ((nowV - thenV) / Math.abs(thenV)) * 100);
  return {
    monthIndex,
    prevIndex,
    revenue: thisM.netRevenue,
    revenueDelta: prev ? thisM.netRevenue - prev.netRevenue : null,
    revenuePct: prev ? pct(thisM.netRevenue, prev.netRevenue) : null,
    profit: thisM.operatingProfit,
    profitDelta: prev ? thisM.operatingProfit - prev.operatingProfit : null,
    enrol: enrol.studentCount,
    enrolDelta: prevEnrol ? enrol.studentCount - prevEnrol.studentCount : null,
  };
}

export function royaltyReport(state: LedgerState, now = new Date()): RoyaltyReport {
  const fyStartMonth = state.settings.fyStartMonth ?? 3;
  const monthIndex = currentFyMonthIndex(now, state.settings.fyStartYear, fyStartMonth);
  const series = licenseFeeSeries(state);
  const y = pnlThrough(state, monthIndex);
  const remainingMonths = Math.max(0, 11 - monthIndex);
  const rate = state.settings.licenseFeeRate || 0;
  return {
    rate,
    mode: state.settings.licenseFeeMode,
    thisMonth: series[monthIndex] ?? 0,
    ytd: y.licenseFee,
    remainingMonths,
    keepPct: state.settings.licenseFeeMode === "percent" ? Math.max(0, 100 - rate) : 100,
  };
}

export function backupHealth(state: LedgerState, now = new Date()): BackupHealth {
  const last = state.settings.lastBackupAt;
  if (!last) return { lastBackupAt: null, days: null, stale: true };
  const at = parseDate(last.slice(0, 10));
  if (!at) return { lastBackupAt: last, days: null, stale: true };
  const days = Math.floor((now.getTime() - at.getTime()) / 86_400_000);
  return { lastBackupAt: last, days, stale: days >= 7 };
}

export function upcomingStarts(state: LedgerState, today = new Date(), windowDays = 21) {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const t = startOf(today);
  return state.students
    .filter((s) => s.status === "waiting")
    .map((s) => {
      const from = parseDate(s.enrolledFrom);
      const days = from
        ? Math.round((startOf(from).getTime() - t.getTime()) / 86_400_000)
        : 999;
      return { student: s, days };
    })
    .filter((row) => row.days >= -7 && row.days <= windowDays)
    .sort((a, b) => a.days - b.days);
}

export function averageFee(state: LedgerState): number {
  const active = state.students.filter((s) => s.status === "active");
  if (!active.length) return 0;
  return active.reduce((sum, s) => sum + studentGross(s), 0) / active.length;
}

export interface ForecastRow {
  id: string;
  name: string;
  date: string;
  reason: "starter" | "returning" | "leaver";
}

export interface TuitionForecast {
  thisIndex: number;
  nextIndex: number;
  thisNet: number;
  thisGross: number;
  thisRoyalty: number;
  thisStudents: number;
  thisSubjects: number;
  nextNet: number;
  nextGross: number;
  nextRoyalty: number;
  nextStudents: number;
  nextSubjects: number;
  nextDiscount: number;
  starters: ForecastRow[];
  returning: ForecastRow[];
  leavers: ForecastRow[];
  renewalsDue: number;
  paymentsDue: number;
  summerCalls: number;
}

function wouldBill(
  student: LedgerState["students"][number],
  settings: LedgerState["settings"],
  monthIndex: number,
): boolean {
  const fyStartMonth = settings.fyStartMonth ?? 3;
  if (isStudentActiveInMonth(student, settings.fyStartYear, monthIndex, fyStartMonth)) return true;
  if (student.status !== "waiting") return false;
  const { end } = monthBounds(settings.fyStartYear, monthIndex, fyStartMonth);
  const from = parseDate(student.enrolledFrom);
  if (!from) return false;
  return from <= end;
}

function projectedEnrolment(state: LedgerState, monthIndex: number) {
  const billed = state.students
    .filter((s) => wouldBill(s, state.settings, monthIndex))
    .map((s) => (s.status === "waiting" ? { ...s, status: "active" as const } : s));
  return enrolmentForMonth(billed, state.settings, monthIndex);
}

function projectedRoyalty(state: LedgerState, monthIndex: number, enrol: ReturnType<typeof enrolmentForMonth>) {
  const { licenseFeeMode, licenseFeeRate, licenseFeeBase } = state.settings;
  if (licenseFeeMode === "per_subject") return enrol.subjectCount * licenseFeeRate;
  const base = licenseFeeBase === "net" ? enrol.net : enrol.gross;
  return (base * licenseFeeRate) / 100;
}

export function tuitionForecast(state: LedgerState, now = new Date()): TuitionForecast {
  const fyStartMonth = state.settings.fyStartMonth ?? 3;
  const thisIndex = currentFyMonthIndex(now, state.settings.fyStartYear, fyStartMonth);
  const nextIndex = Math.min(11, thisIndex + 1);
  const thisEnrol = enrolmentForMonth(state.students, state.settings, thisIndex);
  const nextEnrol = projectedEnrolment(state, nextIndex);
  const thisLicense = licenseFeeSeries(state)[thisIndex] ?? 0;

  const inMonth = (iso: string | null, index: number) => {
    if (!iso) return false;
    const d = parseDate(iso);
    if (!d) return false;
    const abs = fyStartMonth + index;
    return d.getFullYear() === state.settings.fyStartYear + Math.floor(abs / 12) && d.getMonth() === abs % 12;
  };

  const starters: ForecastRow[] = state.students
    .filter(
      (s) =>
        s.status === "waiting" &&
        (inMonth(s.enrolledFrom, thisIndex) || inMonth(s.enrolledFrom, nextIndex)),
    )
    .map((s) => ({ id: s.id, name: s.name, date: s.enrolledFrom, reason: "starter" as const }));

  const returning: ForecastRow[] = state.students
    .filter(
      (s) =>
        s.status === "returning" &&
        (inMonth(s.restartOn, thisIndex) || inMonth(s.restartOn, nextIndex)),
    )
    .map((s) => ({ id: s.id, name: s.name, date: s.restartOn ?? "", reason: "returning" as const }));

  const leavers: ForecastRow[] = state.students
    .filter((s) => s.status === "active" && inMonth(s.enrolledTo, thisIndex))
    .map((s) => ({ id: s.id, name: s.name, date: s.enrolledTo ?? "", reason: "leaver" as const }));

  const grace = state.settings.paymentGraceDays ?? 35;
  const paymentsDue = state.students.filter((s) => {
    if (s.status !== "active") return false;
    if (s.arrears) return true;
    if (!s.lastPaidOn) return false;
    const paid = parseDate(s.lastPaidOn);
    if (!paid) return false;
    const days = Math.round((now.getTime() - paid.getTime()) / 86_400_000);
    return days > grace;
  }).length;

  const desk = buildDesk(state, now).filter((i) => !i.done);

  return {
    thisIndex,
    nextIndex,
    thisNet: thisEnrol.net,
    thisGross: thisEnrol.gross,
    thisRoyalty: thisLicense,
    thisStudents: thisEnrol.studentCount,
    thisSubjects: thisEnrol.subjectCount,
    nextNet: nextEnrol.net,
    nextGross: nextEnrol.gross,
    nextRoyalty: projectedRoyalty(state, nextIndex, nextEnrol),
    nextStudents: nextEnrol.studentCount,
    nextSubjects: nextEnrol.subjectCount,
    nextDiscount: nextEnrol.discount,
    starters,
    returning,
    leavers,
    renewalsDue: desk.filter((i) => i.kind === "renewal").length,
    paymentsDue,
    summerCalls: desk.filter((i) => i.kind === "summer_call").length,
  };
}
