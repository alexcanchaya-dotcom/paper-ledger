import { useMemo, useState } from "react";
import { Bell, Phone, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { bucketOf, buildDesk, emptyTask, formatDay, kindLabel, relativeDue, toIso, type DeskBucket, type DeskItem } from "@/lib/ledger/reminders";
import { kitOf } from "@/lib/ledger/kits";
import { useLedger } from "@/lib/ledger/store";
import type { ReminderKind } from "@/lib/ledger/types";

const BUCKETS: { id: DeskBucket; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "thisWeek", label: "This week" },
  { id: "upcoming", label: "Coming up" },
  { id: "done", label: "Done" },
];

export function FollowUpsSheet() {
  const state = useLedger();
  const kit = kitOf(state.settings.tradeId);
  const today = useMemo(() => new Date(), []);
  const items = useMemo(() => buildDesk(state, today), [state, today]);
  const [draft, setDraft] = useState(() => emptyTask(toIso(today)));

  const grouped = useMemo(() => {
    const map: Record<DeskBucket, DeskItem[]> = { overdue: [], thisWeek: [], upcoming: [], done: [] };
    for (const item of items) map[bucketOf(item, today)].push(item);
    return map;
  }, [items, today]);

  function toggle(item: DeskItem) {
    if (item.source === "manual" && item.taskId) state.toggleTask(item.taskId);
    else state.markReminder(item.key, !item.done);
  }

  function addTask() {
    if (!draft.title.trim()) return;
    state.addTask({ ...draft, title: draft.title.trim() });
    setDraft(emptyTask(toIso(today)));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Desk</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Renewals from each {kit.customer.toLowerCase()} start date
          {kit.showSummer ? ", calls after a pause or summer" : ""}
          {kit.id === "tuition" ? ", missed-fee follow-ups, returning restarts," : ","} and anything else you add. Tick a row when it is done.
        </p>
      </div>

      <form
        className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-[minmax(0,1.4fr)_8.5rem_9rem_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          addTask();
        }}
      >
        <label className="grid gap-1 sm:col-span-1">
          <Label>New reminder</Label>
          <Input
            value={draft.title}
            placeholder="Chase a renewal, order stock, call back…"
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label className="grid gap-1">
          <Label>Due</Label>
          <Input type="date" value={draft.dueOn} onChange={(e) => setDraft({ ...draft, dueOn: e.target.value })} />
        </label>
        <label className="grid gap-1">
          <Label>Type</Label>
          <NativeSelect
            value={draft.kind}
            onChange={(e) => setDraft({ ...draft, kind: e.target.value as ReminderKind })}
          >
            <option value="call">Call parent</option>
            <option value="renewal">Renewal</option>
            {kit.id === "tuition" ? <option value="payment">Missed fee</option> : null}
            {kit.showSummer ? <option value="summer_call">After summer</option> : <option value="summer_call">After pause</option>}
            <option value="admin">Admin</option>
          </NativeSelect>
        </label>
        <div className="flex items-end">
          <Button type="submit" className="h-10 w-full sm:w-auto">
            <Plus className="size-4" />
            Add
          </Button>
        </div>
        <label className="grid gap-1 sm:col-span-2">
          <Label>Link to a {kit.customer.toLowerCase()} (optional)</Label>
          <NativeSelect
            value={draft.studentId ?? ""}
            onChange={(e) => setDraft({ ...draft, studentId: e.target.value || null })}
          >
            <option value="">Not linked</option>
            {state.students
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </NativeSelect>
        </label>
        <label className="grid gap-1 sm:col-span-2">
          <Label>Note</Label>
          <Input
            value={draft.notes}
            placeholder="Optional"
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
      </form>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <Bell className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Nothing on the desk</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Mark a {kit.customer.toLowerCase()} as paused{kit.showSummer ? " or away for summer" : ""}, or add a reminder above.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {BUCKETS.map((bucket) => {
            const list = grouped[bucket.id];
            if (list.length === 0) return null;
            return (
              <section key={bucket.id}>
                <h3 className="mb-2 text-[12px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  {bucket.label}
                  <span className="ml-2 font-mono font-medium tabular-nums"> {list.length}</span>
                </h3>
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {list.map((item) => (
                    <li key={item.key} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-4">
                      <label className="flex min-w-0 flex-1 items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 size-4 shrink-0 accent-primary"
                          checked={item.done}
                          onChange={() => toggle(item)}
                          aria-label={`Mark ${item.title} done`}
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className={`font-medium ${item.done ? "text-muted-foreground line-through" : ""}`}>
                              {item.title}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                              {kindLabel(item.kind, kit.showSummer)}
                            </span>
                          </span>
                          <span className="mt-0.5 block text-[12px] text-muted-foreground">
                            {item.detail}
                            {item.parentName ? ` · ${item.parentName}` : ""}
                          </span>
                        </span>
                      </label>
                      <div className="flex items-center justify-between gap-2 sm:justify-end">
                        <div className="text-right">
                          <p className={`font-mono text-[13px] tabular-nums ${bucket.id === "overdue" && !item.done ? "text-loss" : "text-muted-foreground"}`}>
                            {formatDay(item.dueOn)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">{relativeDue(item.dueOn, today)}</p>
                        </div>
                        {item.parentPhone ? (
                          <a
                            href={`tel:${item.parentPhone.replace(/\s/g, "")}`}
                            className="grid size-10 place-items-center rounded-md hover:bg-muted"
                            aria-label={`Call ${item.parentName || item.studentName}`}
                          >
                            <Phone className="size-4" />
                          </a>
                        ) : null}
                        {item.source === "manual" && item.taskId ? (
                          <button
                            type="button"
                            className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-loss"
                            onClick={() => state.removeTask(item.taskId!)}
                            aria-label="Remove reminder"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      <p className="text-[12px] text-muted-foreground">
        Renewals look {state.settings.renewalNoticeDays} days ahead of each start anniversary.
        {kit.showSummer
          ? ` Summer calls fire on ${formatDay(state.settings.summerReturnDate)} for anyone paused or marked away.`
          : ""}
        {kit.id === "tuition"
          ? ` Missed fees appear if a student is marked in arrears, or last paid more than ${state.settings.paymentGraceDays ?? 35} days ago.`
          : ""}{" "}
        Windows are in Settings.
      </p>
    </div>
  );
}
