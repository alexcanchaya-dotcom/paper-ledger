import { useMemo, useState, type ReactNode } from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { enrolmentForMonth, defaultFeeFor, familyKey, studentGross, subjectFee } from "@/lib/ledger/calc";
import { money } from "@/lib/ledger/format";
import { kitOf, offeringLabel } from "@/lib/ledger/kits";
import { defaultStudent, useLedger } from "@/lib/ledger/store";
import { uid } from "@/lib/utils";
import type { CurrencyCode, Student, StudentStatus } from "@/lib/ledger/types";
import { KUMON_LEVELS, STATUS_LABEL } from "@/lib/ledger/types";

type Filter = "all" | StudentStatus | "away";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "waiting", label: "Waiting" },
  { id: "returning", label: "Returning" },
  { id: "paused", label: "Paused" },
  { id: "away", label: "Away" },
  { id: "left", label: "Left" },
];

export function StudentsSheet() {
  const students = useLedger((s) => s.students);
  const settings = useLedger((s) => s.settings);
  const kit = kitOf(settings.tradeId);
  const isTuition = kit.id === "tuition";
  const offerings = settings.offerings?.length ? settings.offerings : kit.offerings;
  const addStudent = useLedger((s) => s.addStudent);
  const updateStudent = useLedger((s) => s.updateStudent);
  const removeStudent = useLedger((s) => s.removeStudent);
  const patchSettings = useLedger((s) => s.patchSettings);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [draft, setDraft] = useState(defaultStudent());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [customSubject, setCustomSubject] = useState("");

  const now = new Date();
  const fyMonth = settings.fyStartMonth ?? 3;
  const monthIndex = Math.max(
    0,
    Math.min(11, (now.getFullYear() - settings.fyStartYear) * 12 + now.getMonth() - fyMonth),
  );
  const current = enrolmentForMonth(students, settings, monthIndex);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter((s) => {
      if (filter === "away" && !s.awayForSummer) return false;
      if (filter !== "all" && filter !== "away" && s.status !== filter) return false;
      if (!q) return true;
      const hay = [
        s.name,
        s.familyName,
        s.parentName,
        s.parentPhone,
        s.parentEmail,
        s.source,
        s.notes,
        ...(s.tags ?? []),
        ...s.subjects.map((id) => offeringLabel(settings, id)),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [students, query, filter, settings]);

  const waiting = filtered.filter((s) => s.status === "waiting");
  const returning = filtered.filter((s) => s.status === "returning");
  const rest = filtered.filter((s) => s.status !== "waiting" && s.status !== "returning");

  const families = useMemo(() => {
    const map = new Map<string, { label: string; members: Student[] }>();
    for (const s of rest) {
      const raw = s.familyName.trim();
      const key = familyKey(s);
      const entry = map.get(key) ?? { label: raw || "Ungrouped", members: [] };
      if (raw) entry.label = raw;
      entry.members.push(s);
      map.set(key, entry);
    }
    return [...map.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rest]);

  const familyNames = useMemo(
    () =>
      [...new Set(students.map((s) => s.familyName.trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [students],
  );

  function openNew(status: StudentStatus = "active", family?: string) {
    setEditing(null);
    const base = defaultStudent();
    const kin = family
      ? students.find((s) => s.familyName.trim().toLowerCase() === family.trim().toLowerCase() && s.isPrimaryInFamily) ??
        students.find((s) => s.familyName.trim().toLowerCase() === family.trim().toLowerCase())
      : undefined;
    setDraft({
      ...base,
      status,
      familyName: family ?? "",
      isPrimaryInFamily: family ? false : true,
      parentName: kin?.parentName ?? "",
      parentPhone: kin?.parentPhone ?? "",
      parentEmail: kin?.parentEmail ?? "",
      feePerSubject: defaultFeeFor(settings, base.subjects[0] ?? "math"),
      feeBySubject: { [base.subjects[0] ?? "math"]: defaultFeeFor(settings, base.subjects[0] ?? "math") },
    });
    setOpen(true);
  }

  function openEdit(s: Student) {
    setEditing(s);
    setDraft({
      ...defaultStudent(),
      ...s,
      feeBySubject: { ...(s.feeBySubject ?? {}) },
      levelBySubject: { ...(s.levelBySubject ?? {}) },
      tags: s.tags ?? [],
    });
    setOpen(true);
  }

  function save() {
    if (!draft.name.trim()) return;
    const feeBySubject = { ...draft.feeBySubject };
    for (const id of draft.subjects) {
      if (typeof feeBySubject[id] !== "number") feeBySubject[id] = draft.feePerSubject;
    }
    const payload = { ...draft, feeBySubject, feePerSubject: subjectFee({ ...draft, feeBySubject }, draft.subjects[0] ?? "") };
    if (editing) updateStudent(editing.id, payload);
    else addStudent(payload);
    setOpen(false);
  }

  function toggleSubject(sub: string) {
    setDraft((d) => {
      const has = d.subjects.includes(sub);
      const next = has ? d.subjects.filter((x) => x !== sub) : [...d.subjects, sub];
      const subjects = next.length ? next : [sub];
      const feeBySubject = { ...d.feeBySubject };
      if (!has) feeBySubject[sub] = feeBySubject[sub] ?? defaultFeeFor(settings, sub);
      return { ...d, subjects, feeBySubject };
    });
  }

  function addCustomSubject() {
    const label = customSubject.trim();
    if (!label) return;
    const existing = offerings.find((o) => o.label.toLowerCase() === label.toLowerCase());
    const id = existing?.id ?? uid("off");
    if (!existing) {
      patchSettings({ offerings: [...offerings, { id, label }] });
    }
    setDraft((d) => {
      if (d.subjects.includes(id)) return d;
      return {
        ...d,
        subjects: [...d.subjects, id],
        feeBySubject: { ...d.feeBySubject, [id]: defaultFeeFor(settings, id) },
      };
    });
    setCustomSubject("");
  }

  const showDiscount = settings.siblingDiscountPct > 0;
  const counts = {
    waiting: students.filter((s) => s.status === "waiting").length,
    paused: students.filter((s) => s.status === "paused").length,
    away: students.filter((s) => s.awayForSummer).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">{kit.customers}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            {kit.revenue} is billed from this register
            {showDiscount
              ? `. People who share a ${kit.group.toLowerCase()} and are not marked primary get a ${settings.siblingDiscountPct}% ${kit.discount.toLowerCase()}`
              : ""}
            {isTuition ? ". Waiting-list starts appear on the desk." : ""}
            .
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {isTuition ? (
            <Button variant="outline" onClick={() => openNew("waiting")} className="h-11">
              Add to waiting list
            </Button>
          ) : null}
          <Button onClick={() => openNew("active")} className="h-11">
            <Plus className="size-4" />
            Add {kit.customer.toLowerCase()}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Active this month" value={String(current.studentCount)} />
        <Stat label={kit.offeringsLabel} value={String(current.subjectCount)} />
        {isTuition ? (
          <Stat label="Waiting" value={String(counts.waiting)} />
        ) : showDiscount ? (
          <Stat label={kit.discount} value={String(current.siblingCount)} />
        ) : (
          <Stat label="Paused" value={String(counts.paused)} />
        )}
        <Stat label={kit.revenue} value={money(current.gross, settings.currency)} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${kit.customers.toLowerCase()}, ${kit.group.toLowerCase()}, ${kit.contact.toLowerCase()}…`}
            className="pl-9"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {FILTERS.filter((f) => {
            if (f.id === "waiting" && !isTuition) return false;
            if (f.id === "returning" && !isTuition) return false;
            if (f.id === "away" && !kit.showSummer) return false;
            return true;
          }).map((f) => {
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`h-10 rounded-md px-3 text-sm ${on ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <Users className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{students.length === 0 ? `No ${kit.customers.toLowerCase()} yet` : "Nothing matches"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {students.length === 0
              ? `Add the first one — monthly ${kit.revenue.toLowerCase()} on the P&L is driven from here.`
              : "Try a different search or filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {waiting.length ? (
            <section className="overflow-hidden rounded-xl border border-primary/25 bg-card">
              <header className="flex items-center justify-between border-b border-border bg-primary/5 px-4 py-2">
                <h3 className="text-[13px] font-semibold tracking-wide">Waiting list</h3>
                <span className="text-[11px] text-muted-foreground">
                  {waiting.length} · intended start on the desk
                </span>
              </header>
              <ul className="divide-y divide-border">
                {waiting.map((s) => (
                  <StudentRow
                    key={s.id}
                    student={s}
                    members={[s]}
                    settingsCurrency={settings.currency}
                    discountPct={settings.siblingDiscountPct}
                    showDiscount={false}
                    offeringLabels={s.subjects.map((id) => offeringLabel(settings, id)).join(" + ")}
                    isTuition={isTuition}
                    onEdit={() => openEdit(s)}
                    onRemove={() => removeStudent(s.id)}
                    onEnrol={() => updateStudent(s.id, { status: "active" })}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {returning.length ? (
            <section className="overflow-hidden rounded-xl border border-border bg-card">
              <header className="flex items-center justify-between border-b border-border bg-muted/50 px-4 py-2">
                <h3 className="text-[13px] font-semibold tracking-wide">Returning</h3>
                <span className="text-[11px] text-muted-foreground">
                  {returning.length} · billed from the restart date
                </span>
              </header>
              <ul className="divide-y divide-border">
                {returning.map((s) => (
                  <StudentRow
                    key={s.id}
                    student={s}
                    members={[s]}
                    settingsCurrency={settings.currency}
                    discountPct={settings.siblingDiscountPct}
                    showDiscount={false}
                    offeringLabels={s.subjects.map((id) => offeringLabel(settings, id)).join(" + ")}
                    isTuition={isTuition}
                    onEdit={() => openEdit(s)}
                    onRemove={() => removeStudent(s.id)}
                    onRestart={() =>
                      updateStudent(s.id, { status: "active", awayForSummer: false, restartOn: s.restartOn })
                    }
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {families.map(({ key, label: family, members }) => {
            const contact = members.find((m) => m.isPrimaryInFamily) ?? members[0];
            return (
            <section key={key} className="overflow-hidden rounded-xl border border-border bg-card">
              <header className="flex items-center justify-between gap-2 border-b border-border bg-muted/50 px-4 py-2">
                <div className="min-w-0">
                  <h3 className="text-[13px] font-semibold tracking-wide">{family}</h3>
                  {isTuition && contact?.parentName ? (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {contact.parentName}
                      {contact.parentPhone ? ` · ${contact.parentPhone}` : ""}
                    </p>
                  ) : null}
                </div>
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {members.length} {members.length === 1 ? kit.customer.toLowerCase() : kit.customers.toLowerCase()}
                  {showDiscount && members.length > 1 ? ` · ${kit.discount.toLowerCase()}` : ""}
                  {isTuition ? (
                    <button
                      type="button"
                      className="h-8 rounded-md px-2 text-xs font-medium text-primary hover:bg-muted"
                      onClick={() => openNew("active", members[0]?.familyName || family)}
                    >
                      Add sibling
                    </button>
                  ) : null}
                </span>
              </header>
              <ul className="divide-y divide-border">
                {members.map((s) => (
                  <StudentRow
                    key={s.id}
                    student={s}
                    members={members}
                    settingsCurrency={settings.currency}
                    discountPct={settings.siblingDiscountPct}
                    showDiscount={showDiscount}
                    offeringLabels={s.subjects.map((id) => offeringLabel(settings, id)).join(" + ")}
                    isTuition={isTuition}
                    onEdit={() => openEdit(s)}
                    onRemove={() => removeStudent(s.id)}
                    onMarkPaid={() =>
                      updateStudent(s.id, { arrears: false, lastPaidOn: new Date().toISOString().slice(0, 10) })
                    }
                  />
                ))}
              </ul>
            </section>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={editing ? `Edit ${kit.customer.toLowerCase()}` : `Add ${kit.customer.toLowerCase()}`}
          description={
            showDiscount
              ? `Match ${kit.group.toLowerCase()} names so the ${kit.discount.toLowerCase()} applies automatically.`
              : `This record drives monthly ${kit.revenue.toLowerCase()} on the P&L.`
          }
        >
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1">
            <Field label="Name">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label={kit.group}>
              <Input
                value={draft.familyName}
                list="family-names"
                onChange={(e) => {
                  const familyName = e.target.value;
                  const kin = students.find(
                    (s) => s.familyName.trim().toLowerCase() === familyName.trim().toLowerCase() && s.isPrimaryInFamily,
                  );
                  setDraft({
                    ...draft,
                    familyName,
                    parentName: draft.parentName || kin?.parentName || "",
                    parentPhone: draft.parentPhone || kin?.parentPhone || "",
                    parentEmail: draft.parentEmail || kin?.parentEmail || "",
                    isPrimaryInFamily: kin ? false : draft.isPrimaryInFamily,
                  });
                }}
              />
              <datalist id="family-names">
                {familyNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <NativeSelect
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value as Student["status"] })}
                >
                  <option value="active">Active</option>
                  {isTuition ? <option value="waiting">Waiting list</option> : null}
                  {isTuition ? <option value="returning">Returning</option> : null}
                  <option value="paused">Paused</option>
                  <option value="left">Left</option>
                </NativeSelect>
              </Field>
              {isTuition ? (
                <Field label="Days / week">
                  <NativeSelect
                    value={String(draft.daysPerWeek || 2)}
                    onChange={(e) => setDraft({ ...draft, daysPerWeek: Number(e.target.value) || 2 })}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                  </NativeSelect>
                </Field>
              ) : (
                <Field label={`Fee per ${kit.offering.toLowerCase()} / month`}>
                  <Input
                    inputMode="decimal"
                    value={draft.feePerSubject}
                    onChange={(e) => {
                      const n = Number(e.target.value) || 0;
                      const feeBySubject = { ...draft.feeBySubject };
                      for (const id of draft.subjects) feeBySubject[id] = n;
                      setDraft({ ...draft, feePerSubject: n, feeBySubject });
                    }}
                  />
                </Field>
              )}
            </div>
            <fieldset>
              <legend className="text-[13px] font-medium text-muted-foreground">{kit.offeringsLabel}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {offerings.map((sub) => {
                  const on = draft.subjects.includes(sub.id);
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => toggleSubject(sub.id)}
                      className={`h-10 rounded-md border px-3 text-sm ${on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            {isTuition ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  addCustomSubject();
                }}
              >
                <Input
                  value={customSubject}
                  placeholder="Add another subject (handwriting, science…)"
                  onChange={(e) => setCustomSubject(e.target.value)}
                />
                <Button type="submit" variant="outline" className="h-10 shrink-0">
                  Add
                </Button>
              </form>
            ) : null}
            {isTuition
              ? draft.subjects.map((id) => (
                  <div key={id} className="grid grid-cols-2 gap-3">
                    <Field label={`${offeringLabel(settings, id)} fee / month`}>
                      <Input
                        inputMode="decimal"
                        value={subjectFee(draft, id)}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            feeBySubject: { ...draft.feeBySubject, [id]: Number(e.target.value) || 0 },
                          })
                        }
                      />
                    </Field>
                    <Field label={`${offeringLabel(settings, id)} level`}>
                      <NativeSelect
                        value={draft.levelBySubject?.[id] ?? ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            levelBySubject: { ...draft.levelBySubject, [id]: e.target.value },
                          })
                        }
                      >
                        <option value="">Not set</option>
                        {KUMON_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                  </div>
                ))
              : null}
            {showDiscount ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.isPrimaryInFamily}
                  onChange={(e) => setDraft({ ...draft, isPrimaryInFamily: e.target.checked })}
                />
                Primary in {kit.group.toLowerCase()} (full fee — others get the {kit.discount.toLowerCase()})
              </label>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <Field label={draft.status === "waiting" ? "Intended start" : "Enrolment date"}>
                <Input type="date" value={draft.enrolledFrom} onChange={(e) => setDraft({ ...draft, enrolledFrom: e.target.value })} />
              </Field>
              <Field label="End date (optional)">
                <Input
                  type="date"
                  value={draft.enrolledTo ?? ""}
                  onChange={(e) => setDraft({ ...draft, enrolledTo: e.target.value || null })}
                />
              </Field>
            </div>
            {isTuition ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Renewal date (optional)">
                  <Input
                    type="date"
                    value={draft.renewalOn ?? ""}
                    onChange={(e) => setDraft({ ...draft, renewalOn: e.target.value || null })}
                  />
                </Field>
                <Field label={draft.status === "returning" || draft.status === "paused" ? "Restart date" : "Restart date (if away)"}>
                  <Input
                    type="date"
                    value={draft.restartOn ?? ""}
                    onChange={(e) => setDraft({ ...draft, restartOn: e.target.value || null })}
                  />
                </Field>
              </div>
            ) : null}
            <Field label={kit.contact}>
              <Input value={draft.parentName} onChange={(e) => setDraft({ ...draft, parentName: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                <Input value={draft.parentPhone} onChange={(e) => setDraft({ ...draft, parentPhone: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input value={draft.parentEmail} onChange={(e) => setDraft({ ...draft, parentEmail: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {isTuition ? (
                <Field label="Last parent call">
                  <Input
                    type="date"
                    value={draft.lastParentCall ?? ""}
                    onChange={(e) => setDraft({ ...draft, lastParentCall: e.target.value || null })}
                  />
                </Field>
              ) : (
                <Field label="Renewal date (optional)">
                  <Input
                    type="date"
                    value={draft.renewalOn ?? ""}
                    onChange={(e) => setDraft({ ...draft, renewalOn: e.target.value || null })}
                  />
                </Field>
              )}
              {isTuition ? (
                <Field label="Last fee paid">
                  <Input
                    type="date"
                    value={draft.lastPaidOn ?? ""}
                    onChange={(e) => setDraft({ ...draft, lastPaidOn: e.target.value || null })}
                  />
                </Field>
              ) : (
                <Field label="Last call">
                  <Input
                    type="date"
                    value={draft.lastParentCall ?? ""}
                    onChange={(e) => setDraft({ ...draft, lastParentCall: e.target.value || null })}
                  />
                </Field>
              )}
            </div>
            {isTuition ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.arrears}
                  onChange={(e) => setDraft({ ...draft, arrears: e.target.checked })}
                />
                In arrears — put a missed-fee reminder on the desk
              </label>
            ) : null}
            {isTuition ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label="How they found you">
                  <NativeSelect value={draft.source} onChange={(e) => setDraft({ ...draft, source: e.target.value })}>
                    <option value="">Not set</option>
                    <option value="Walk-in">Walk-in</option>
                    <option value="Sibling">Sibling</option>
                    <option value="School">School</option>
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                  </NativeSelect>
                </Field>
                <Field label="Goal date">
                  <Input
                    type="date"
                    value={draft.goalDate ?? ""}
                    onChange={(e) => setDraft({ ...draft, goalDate: e.target.value || null })}
                  />
                </Field>
              </div>
            ) : null}
            {kit.showSummer ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.awayForSummer}
                  onChange={(e) => setDraft({ ...draft, awayForSummer: e.target.checked })}
                />
                Away for summer — remind me to call when term restarts
              </label>
            ) : null}
            {isTuition ? (
              <Field label="Tags">
                <Input
                  value={draft.tags.join(", ")}
                  placeholder="exam year, new, scholarship"
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
            ) : null}
            <Field label="Notes">
              <Input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </Field>
            {showDiscount && draft.familyName.trim() ? (
              <p className="rounded-md bg-muted px-3 py-2 text-sm">
                {(() => {
                  const others = students.filter(
                    (s) =>
                      familyKey(s) === draft.familyName.trim().toLowerCase() &&
                      (!editing || s.id !== editing.id),
                  );
                  const familySize = others.length + 1;
                  const gross = studentGross(draft);
                  const discounted = familySize >= 2 && !draft.isPrimaryInFamily;
                  const net = discounted ? gross * (1 - settings.siblingDiscountPct / 100) : gross;
                  if (familySize < 2) {
                    return `Only child in ${draft.familyName.trim()} so far — full fee ${money(gross, settings.currency)}/mo. Add a sibling to apply the ${settings.siblingDiscountPct}% family discount.`;
                  }
                  return discounted
                    ? `${money(net, settings.currency)}/mo after ${settings.siblingDiscountPct}% family discount (${money(gross, settings.currency)} gross). Primary pays full fee.`
                    : `Primary in ${draft.familyName.trim()} — full fee ${money(gross, settings.currency)}/mo. ${others.length} other ${others.length === 1 ? "child" : "children"} get the ${settings.siblingDiscountPct}% discount.`;
                })()}
              </p>
            ) : null}
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={save}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudentRow({
  student: s,
  members,
  settingsCurrency,
  discountPct,
  showDiscount,
  offeringLabels,
  isTuition,
  onEdit,
  onRemove,
  onMarkPaid,
  onEnrol,
  onRestart,
}: {
  student: Student;
  members: Student[];
  settingsCurrency: CurrencyCode;
  discountPct: number;
  showDiscount: boolean;
  offeringLabels: string;
  isTuition: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onMarkPaid?: () => void;
  onEnrol?: () => void;
  onRestart?: () => void;
}) {
  const fee = studentGross(s);
  const discounted = showDiscount && members.length > 1 && !s.isPrimaryInFamily;
  const net = discounted ? fee * (1 - discountPct / 100) : fee;
  const levels = Object.entries(s.levelBySubject ?? {})
    .filter(([, v]) => v)
    .map(([, v]) => v)
    .join(" / ");
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{s.name}</p>
          {s.isPrimaryInFamily && showDiscount ? (
            <span className="whitespace-nowrap rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium tracking-wide text-secondary-foreground uppercase">
              Primary
            </span>
          ) : null}
          {discounted ? (
            <span className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-primary uppercase">
              −{discountPct}%
            </span>
          ) : null}
          {s.status !== "active" ? (
            <span className="text-[11px] text-muted-foreground uppercase">{STATUS_LABEL[s.status] ?? s.status}</span>
          ) : null}
          {s.awayForSummer ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Away
            </span>
          ) : null}
          {s.arrears ? (
            <span className="whitespace-nowrap rounded-full bg-loss/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-loss uppercase">
              Arrears
            </span>
          ) : null}
          {s.tags?.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {offeringLabels}
          {isTuition && levels ? ` · ${levels}` : ""}
          {isTuition && s.daysPerWeek ? ` · ${s.daysPerWeek}d/wk` : ""}
          {s.status === "waiting" ? ` · start ${s.enrolledFrom}` : ` · from ${s.enrolledFrom}`}
          {s.restartOn && (s.status === "returning" || s.status === "paused") ? ` · restart ${s.restartOn}` : ""}
          {s.enrolledTo ? ` to ${s.enrolledTo}` : ""}
        </p>
      </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="text-right">
          <p className="font-mono text-sm tabular-nums">
            {money(net, settingsCurrency)}
            <span className="text-muted-foreground">/mo</span>
          </p>
          {discounted ? (
            <p className="font-mono text-[11px] text-muted-foreground line-through">{money(fee, settingsCurrency)}</p>
          ) : null}
        </div>
        <div className="flex items-center">
          {isTuition && s.arrears && onMarkPaid ? (
            <button
              type="button"
              className="h-10 rounded-md px-2 text-xs font-medium text-primary hover:bg-muted"
              onClick={onMarkPaid}
            >
              Mark paid
            </button>
          ) : null}
          {isTuition && s.status === "waiting" && onEnrol ? (
            <button
              type="button"
              className="h-10 rounded-md px-2 text-xs font-medium text-primary hover:bg-muted"
              onClick={onEnrol}
            >
              Enrol now
            </button>
          ) : null}
          {isTuition && s.status === "returning" && onRestart ? (
            <button
              type="button"
              className="h-10 rounded-md px-2 text-xs font-medium text-primary hover:bg-muted"
              onClick={onRestart}
            >
              Restarted
            </button>
          ) : null}
          <button type="button" aria-label={`Edit ${s.name}`} className="grid size-10 place-items-center rounded-md hover:bg-muted" onClick={onEdit}>
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Remove ${s.name}`}
            className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-loss"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-mono text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
