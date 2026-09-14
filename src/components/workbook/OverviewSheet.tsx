import { CentreDashboard } from "./CentreDashboard";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  computeTax,
  currentFyMonthIndex,
  enrolmentForMonth,
  monthPnL,
  pnlThrough,
  yearPnL,
} from "@/lib/ledger/calc";
import { fyLabel, money } from "@/lib/ledger/format";
import { kitOf } from "@/lib/ledger/kits";
import { bucketOf, buildDesk, formatDay, relativeDue } from "@/lib/ledger/reminders";
import {
  averageFee,
  backupHealth,
  census,
  levelMix,
  monthOverMonth,
  royaltyReport,
  subjectMix,
  upcomingStarts,
} from "@/lib/ledger/reports";
import { useLedger } from "@/lib/ledger/store";
import { fyMonths } from "@/lib/ledger/types";

export function OverviewSheet({ onOpenSheet }: { onOpenSheet: (id: string) => void }) {
  const state = useLedger();
  const kit = kitOf(state.settings.tradeId);
  const isTuition = kit.id === "tuition";
  if (isTuition) return <CentreDashboard onOpenSheet={onOpenSheet} />;
  const fyStartMonth = state.settings.fyStartMonth ?? 3;
  const monthNames = fyMonths(fyStartMonth);
  const monthIndex = currentFyMonthIndex(new Date(), state.settings.fyStartYear, fyStartMonth);
  const ytd = pnlThrough(state, monthIndex);
  const fy = yearPnL(state);
  const tax = computeTax(state);
  const thisMonth = monthPnL(state, monthIndex);
  const enrol = enrolmentForMonth(state.students, state.settings, monthIndex);
  const pop = census(state, monthIndex);
  const mix = subjectMix(state, monthIndex);
  const mom = monthOverMonth(state);
  const royalty = royaltyReport(state);
  const backup = backupHealth(state);
  const levels = isTuition ? levelMix(state) : [];
  const starts = isTuition ? upcomingStarts(state) : [];
  const avg = averageFee(state);
  const c = state.settings.currency;
  const chart = monthNames.map((m, i) => {
    const p = monthPnL(state, i);
    return {
      month: m,
      revenue: Math.round(p.netRevenue),
      costs: Math.round(p.totalCosts),
      profit: Math.round(p.operatingProfit),
    };
  });

  const costSlices = [
    { name: kit.royalty, value: ytd.licenseFee },
    ...ytd.operatingExpenses.map((e) => ({ name: e.name, value: e.amount })),
    { name: "Amortisation", value: ytd.amortisation },
  ].filter((s) => s.value > 0);

  const maxMix = Math.max(...mix.map((s) => s.revenue), 1);
  const desk = buildDesk(state).filter((i) => !i.done).slice(0, 6);
  const emptyBooks = state.students.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
          {state.settings.city} · {fyLabel(state.settings.fyStartYear, fyStartMonth)} · {monthNames[monthIndex]}
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          {state.settings.centreName || "Your business"}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {state.settings.instructorName ? `${kit.owner} ${state.settings.instructorName}. ` : ""}
          {kit.blurb}
        </p>
      </div>

      {backup.stale ? (
        <button
          type="button"
          onClick={() => onOpenSheet("export")}
          className="flex w-full flex-col gap-1 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-left sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm">
            {backup.lastBackupAt
              ? `Last backup was ${backup.days === 1 ? "yesterday" : `${backup.days} days ago`}.`
              : "These books have never been backed up on this device."}{" "}
            Save a JSON backup before you change computers.
          </p>
          <span className="shrink-0 text-sm font-medium text-primary">Open export</span>
        </button>
      ) : null}

      {state.settings.isSample ? (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Example figures for a {kit.name.toLowerCase()} — click around, then replace them with yours.
          </p>
          <button
            type="button"
            className="shrink-0 text-left text-sm font-medium text-primary hover:underline"
            onClick={() => onOpenSheet("settings")}
          >
            Start a blank year
          </button>
        </div>
      ) : emptyBooks ? (
        <ol className="grid gap-2 sm:grid-cols-3">
          <StartStep n="1" title={`Add a ${kit.customer.toLowerCase()}`} onClick={() => onOpenSheet("students")}>
            {`The register drives monthly ${kit.revenue.toLowerCase()}.`}
          </StartStep>
          <StartStep n="2" title="Type this month’s costs" onClick={() => onOpenSheet("pnl")}>
            Rent, wages, the rest — grey cells calculate themselves.
          </StartStep>
          <StartStep n="3" title="Put a note on the desk" onClick={() => onOpenSheet("desk")}>
            Renewals appear on their own. Add anything else you must not forget.
          </StartStep>
        </ol>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={`${monthNames[monthIndex]} net revenue`}
          value={money(thisMonth.netRevenue, c)}
          hint={deltaHint(mom.revenueDelta, mom.revenuePct, c, "vs last month")}
          onClick={() => onOpenSheet("pnl")}
        />
        {state.settings.licenseFeeRate > 0 ? (
          <Kpi
            label={`${kit.royalty} this month`}
            value={money(royalty.thisMonth, c)}
            hint={`YTD ${money(royalty.ytd, c)} · you keep ${royalty.keepPct.toFixed(2)}%`}
            onClick={() => onOpenSheet("pnl")}
          />
        ) : (
          <Kpi
            label={`Active ${kit.customers.toLowerCase()}`}
            value={String(pop.active)}
            hint={`${enrol.subjectCount} ${kit.offeringsLabel.toLowerCase()} billed this month`}
            onClick={() => onOpenSheet("students")}
          />
        )}
        <Kpi
          label="Operating profit (YTD)"
          value={money(ytd.operatingProfit, c)}
          hint={`FY ${money(fy.operatingProfit, c)} · ${deltaHint(mom.profitDelta, null, c, "this month vs last")}`}
          tone={ytd.operatingProfit >= 0 ? "good" : "bad"}
        />
        <Kpi
          label="Tax payable"
          value={money(tax.taxPayable, c)}
          hint={
            state.settings.taxRatePct
              ? `${state.settings.taxRatePct}%${state.settings.cessPct ? ` + ${state.settings.cessPct}% cess` : ""}`
              : "Set a rate in Settings"
          }
          onClick={() => onOpenSheet("tax")}
        />
      </div>

      {isTuition ? (
        <section className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Pulse label="On the register" value={String(pop.active)} hint={`${pop.families} families · ${pop.dualSubject} dual subject`} onClick={() => onOpenSheet("students")} />
          <Pulse label="Waiting list" value={String(pop.waiting)} hint={starts.length ? `${starts.length} starting soon` : "No starts in the next three weeks"} onClick={() => onOpenSheet("students")} />
          <Pulse label="Away / paused" value={String(pop.paused + pop.away)} hint={`${pop.away} marked away for summer`} onClick={() => onOpenSheet("desk")} />
          <Pulse label="Avg monthly fee" value={money(avg, c)} hint={`${pop.siblingCount} on family discount this month`} />
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-medium">Monthly revenue vs costs</h3>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => onOpenSheet("pnl")}>
              Open P&L
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} barGap={2} barCategoryGap="22%">
                <CartesianGrid vertical={false} stroke="var(--color-grid)" />
                <XAxis dataKey="month" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                  formatter={(value) => money(Number(value ?? 0), c)}
                />
                <Bar dataKey="revenue" name="Net revenue" fill="var(--color-secondary)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="costs" name="Costs" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-medium">{isTuition ? "Subject mix (active)" : `Mix of ${kit.offeringsLabel.toLowerCase()}`}</h3>
          {mix.every((s) => s.count === 0) ? (
            <p className="mt-4 text-sm text-muted-foreground">No billed {kit.customers.toLowerCase()} this month.</p>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {mix.map((s) => (
                <li key={s.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{s.label} · {s.count}</span>
                    <span className="font-mono tabular-nums text-muted-foreground">{money(s.revenue, c)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(4, (s.revenue / maxMix) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {isTuition && levels.length ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Levels on the books: {levels.slice(0, 8).map((l) => `${l.label} (${l.count})`).join(" · ")}
            </p>
          ) : null}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-medium">On the desk</h3>
            <button type="button" className="text-xs text-primary hover:underline" onClick={() => onOpenSheet("desk")}>
              Open desk
            </button>
          </div>
          {desk.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open renewals or calls. Add one on the Desk sheet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {desk.map((item) => {
                const bucket = bucketOf(item);
                return (
                  <li key={item.key} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{item.title}</span>
                    <span className={`shrink-0 font-mono text-xs tabular-nums ${bucket === "overdue" ? "text-loss" : "text-muted-foreground"}`}>
                      {bucket === "overdue" ? relativeDue(item.dueOn) : formatDay(item.dueOn)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-medium">{isTuition ? "Royalty & this month" : "This month at a glance"}</h3>
          <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <Pair k={`${kit.revenue} (gross)`} v={money(thisMonth.grossTuition, c)} />
            {state.settings.siblingDiscountPct > 0 ? <Pair k={kit.discount} v={money(-thisMonth.siblingDiscount, c)} /> : null}
            {state.settings.licenseFeeRate > 0 ? <Pair k={`${kit.royalty} (${monthNames[monthIndex]})`} v={money(thisMonth.licenseFee, c)} /> : null}
            <Pair k="Operating profit" v={money(thisMonth.operatingProfit, c)} />
            {isTuition ? <Pair k="Billed this month" v={`${enrol.studentCount} students / ${enrol.subjectCount} subjects`} /> : null}
          </dl>
          {costSlices.length ? (
            <ul className="mt-4 space-y-2">
              {costSlices
                .sort((a, b) => b.value - a.value)
                .slice(0, 4)
                .map((s) => (
                  <li key={s.name} className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-muted-foreground">{s.name}</span>
                    <span className="font-mono tabular-nums">{money(s.value, c)}</span>
                  </li>
                ))}
            </ul>
          ) : null}
        </section>
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-medium">Take it with you</h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Live books stay in this browser. Excel is for the accountant. A backup is how you
              move computers. The link is how someone else starts their own kit.
            </p>
          </div>
          <button
            type="button"
            className="h-11 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            onClick={() => onOpenSheet("export")}
          >
            Open export
          </button>
        </div>
      </section>
    </div>
  );
}

function deltaHint(delta: number | null, pct: number | null, currency: Parameters<typeof money>[1], suffix: string) {
  if (delta == null) return "First month of the year";
  const sign = delta > 0 ? "+" : "";
  const p = pct == null ? "" : ` (${sign}${pct.toFixed(0)}%)`;
  return `${sign}${money(delta, currency)}${p} ${suffix}`;
}

function StartStep({
  n,
  title,
  children,
  onClick,
}: {
  n: string;
  title: string;
  children: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex h-full w-full gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left"
      >
        <span className="font-mono text-sm text-primary">{n}</span>
        <span>
          <span className="block font-medium">{title}</span>
          <span className="mt-0.5 block text-sm text-muted-foreground">{children}</span>
        </span>
      </button>
    </li>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "good" | "bad";
  onClick?: () => void;
}) {
  const inner = (
    <>
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-2 font-mono text-xl font-medium tabular-nums sm:text-2xl ${tone === "good" ? "text-profit" : tone === "bad" ? "text-loss" : ""}`}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="rounded-xl border border-border bg-card px-4 py-4 text-left">
        {inner}
      </button>
    );
  }
  return <div className="rounded-xl border border-border bg-card px-4 py-4 text-left">{inner}</div>;
}

function Pulse({
  label,
  value,
  hint,
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-mono text-xl font-medium tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left">
        {inner}
      </button>
    );
  }
  return <div>{inner}</div>;
}

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border py-1.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono tabular-nums">{v}</dd>
    </div>
  );
}
