import type { LedgerState, ReminderKind, Student, Task } from "./types";
import { kitOf } from "./kits";

export type DeskBucket = "overdue" | "thisWeek" | "upcoming" | "done";

export interface DeskItem {
  key: string;
  kind: ReminderKind;
  title: string;
  detail: string;
  dueOn: string;
  studentId: string | null;
  studentName?: string;
  parentName?: string;
  parentPhone?: string;
  source: "auto" | "manual";
  taskId?: string;
  done: boolean;
}

export const KIND_LABEL: Record<ReminderKind, string> = {
  renewal: "Renewal",
  summer_call: "After pause",
  call: "Call",
  admin: "Admin",
  payment: "Payment",
};

export function kindLabel(kind: ReminderKind, summer = false): string {
  if (kind === "summer_call") return summer ? "After summer" : "After pause";
  if (kind === "payment") return "Missed fee";
  return KIND_LABEL[kind];
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toIso(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysUntil(dueIso: string, today = new Date()): number {
  const due = startOfDay(parseIso(dueIso));
  const t = startOfDay(today);
  return Math.round((due.getTime() - t.getTime()) / 86_400_000);
}

export function formatDay(iso: string): string {
  const d = parseIso(iso);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function relativeDue(iso: string, today = new Date()): string {
  const n = daysUntil(iso, today);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < 0) return `${Math.abs(n)} days overdue`;
  return `In ${n} days`;
}

export function bucketOf(item: DeskItem, today = new Date()): DeskBucket {
  if (item.done) return "done";
  const n = daysUntil(item.dueOn, today);
  if (n < 0) return "overdue";
  if (n <= 7) return "thisWeek";
  return "upcoming";
}

function renewalCandidate(student: Student, today: Date, noticeDays: number): string | null {
  if (student.renewalOn) {
    const n = daysUntil(student.renewalOn, today);
    if (n >= -60 && n <= noticeDays) return student.renewalOn;
    return null;
  }
  const [, m, d] = student.enrolledFrom.split("-").map(Number);
  const year = today.getFullYear();
  const dates = [year - 1, year, year + 1].map((y) => toIso(new Date(y, (m ?? 1) - 1, d ?? 1)));
  return dates.find((iso) => {
    const n = daysUntil(iso, today);
    return n >= -60 && n <= noticeDays;
  }) ?? null;
}

export function buildDesk(state: LedgerState, today = new Date()): DeskItem[] {
  const done = new Set(state.doneReminderKeys ?? []);
  const notice = state.settings.renewalNoticeDays ?? 30;
  const summerDue = state.settings.summerReturnDate;
  const kit = kitOf(state.settings.tradeId);
  const offeringLabel = (id: string) => kit.offerings.find((o) => o.id === id)?.label ?? id;
  const items: DeskItem[] = [];

  for (const s of state.students) {
    if (s.status === "left") continue;

    if (s.status === "waiting") {
      const start = s.enrolledFrom;
      const n = daysUntil(start, today);
      if (n >= -7 && n <= 21) {
        const key = `start:${s.id}:${start}`;
        items.push({
          key,
          kind: "admin",
          title: n < 0 ? `Start date passed — ${s.name}` : `Waiting list start — ${s.name}`,
          detail: `${s.subjects.map(offeringLabel).join(" + ")} · intended ${formatDay(start)}`,
          dueOn: start,
          studentId: s.id,
          studentName: s.name,
          parentName: s.parentName,
          parentPhone: s.parentPhone,
          source: "auto",
          done: done.has(key),
        });
      }
      continue;
    }

    if (s.status === "returning") {
      const due = s.restartOn || summerDue || toIso(today);
      const n = daysUntil(due, today);
      if (n >= -30 && n <= Math.max(notice, 21)) {
        const key = `return:${s.id}:${due}`;
        items.push({
          key,
          kind: "admin",
          title: `Returning — ${s.name}`,
          detail: s.restartOn ? `Restart ${formatDay(s.restartOn)}` : "No restart date set",
          dueOn: due,
          studentId: s.id,
          studentName: s.name,
          parentName: s.parentName,
          parentPhone: s.parentPhone,
          source: "auto",
          done: done.has(key),
        });
      }
    }

    if (kit.id === "tuition" && s.status === "active") {
      const grace = state.settings.paymentGraceDays ?? 35;
      const stale =
        s.arrears ||
        (s.lastPaidOn
          ? daysUntil(s.lastPaidOn, today) < -grace
          : false);
      if (stale) {
        const due = s.lastPaidOn
          ? toIso(new Date(parseIso(s.lastPaidOn).getTime() + grace * 86_400_000))
          : toIso(today);
        const key = `pay:${s.id}:${s.lastPaidOn ?? "flag"}`;
        items.push({
          key,
          kind: "payment",
          title: `Missed fee — ${s.name}`,
          detail: s.arrears
            ? "Marked in arrears on the register"
            : s.lastPaidOn
              ? `Last paid ${formatDay(s.lastPaidOn)}`
              : "No payment recorded",
          dueOn: due,
          studentId: s.id,
          studentName: s.name,
          parentName: s.parentName,
          parentPhone: s.parentPhone,
          source: "auto",
          done: done.has(key),
        });
      }
    }

    const renewal = renewalCandidate(s, today, notice);
    if (renewal) {
      const key = `renewal:${s.id}:${renewal}`;
      items.push({
        key,
        kind: "renewal",
        title: `Renewal due — ${s.name}`,
        detail: `${s.subjects.map(offeringLabel).join(" + ")} · started ${formatDay(s.enrolledFrom)}`,
        dueOn: renewal,
        studentId: s.id,
        studentName: s.name,
        parentName: s.parentName,
        parentPhone: s.parentPhone,
        source: "auto",
        done: done.has(key),
      });
    }

    if (kit.showSummer && (s.awayForSummer || s.status === "paused")) {
      const due = summerDue || toIso(today);
      const key = `summer:${s.id}:${due}`;
      items.push({
        key,
        kind: "summer_call",
        title: kit.showSummer ? `Call after summer — ${s.name}` : `Call after pause — ${s.name}`,
        detail: s.status === "paused" ? "Paused on the register" : "Marked away for summer",
        dueOn: due,
        studentId: s.id,
        studentName: s.name,
        parentName: s.parentName,
        parentPhone: s.parentPhone,
        source: "auto",
        done: done.has(key),
      });
    }
  }

  for (const t of state.tasks ?? []) {
    const student = t.studentId ? state.students.find((s) => s.id === t.studentId) : undefined;
    items.push({
      key: `task:${t.id}`,
      kind: t.kind,
      title: t.title,
      detail: t.notes || (student ? student.name : ""),
      dueOn: t.dueOn,
      studentId: t.studentId,
      studentName: student?.name,
      parentName: student?.parentName,
      parentPhone: student?.parentPhone,
      source: "manual",
      taskId: t.id,
      done: t.done,
    });
  }

  return items.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const byDue = a.dueOn.localeCompare(b.dueOn);
    if (byDue !== 0) return byDue;
    return a.title.localeCompare(b.title);
  });
}

export function openDeskCount(state: LedgerState, today = new Date()): number {
  return buildDesk(state, today).filter((i) => !i.done && daysUntil(i.dueOn, today) <= 7).length;
}

export function emptyTask(dueOn: string): Omit<Task, "id"> {
  return {
    title: "",
    dueOn,
    kind: "call",
    studentId: null,
    notes: "",
    done: false,
  };
}
