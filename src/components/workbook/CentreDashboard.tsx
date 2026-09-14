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
  monthPnL,
  pnlThrough,
  yearPnL,
} from "@/lib/ledger/calc";
import { fyLabel, money } from "@/lib/ledger/format";
import { kitOf } from "@/lib/ledger/kits";
import { bucketOf, buildDesk, formatDay, relativeDue } from "@/lib/ledger/reminders";
import {
  averageFee,
  census,
  levelMix,
  monthOverMonth,
  royaltyReport,
  subjectMix,
  tuitionForecast,
} from "@/lib/ledger/reports";
import { useLedger } from "@/lib/ledger/store";
import { fyMonths } from "@/lib/ledger/types";

export function CentreDashboard({ onOpenSheet }: { onOpenSheet: (id: string) => void }) {
  const state = useLedger();
  const kit = kitOf(state.settings.tradeId);
  const fyStartMonth = state.settings.fyStartMonth ?? 3;
  const monthNames = fyMonths(fyStartMonth);
  const monthIndex = currentFyMonthIndex(new Date(), state.settings.fyStartYear, fyStartMonth);
  const ytd = pnlThrough(state, monthIndex);
  const fy = yearPnL(state);
  const tax = computeTax(state);
  const thisMonth = monthPnL(state, monthIndex);
  const pop = census(state, monthIndex);
  const mix = subjectMix(state, monthIndex);
  const mom = monthOverMonth(state);
  const royalty = royaltyReport(state);
  const levels = levelMix(state);
  const avg = averageFee(state);
  const forecast = tuitionForecast(state);
  const c = state.settings.currency;
  const desk = buildDesk(state).filter((i) => !i.done);
  const renewalsDue = desk.filter((i) => i.kind === "renewal").length;
  const paymentsDue = desk.filter((i) => i.kind === "payment").length;
  const returningDue = desk.filter((i) => i.title.startsWith("Returning")).length;
  const chart = monthNames.map((m, i) => {
    const p = monthPnL(state, i);
    return { month: m, revenue: Math.round(p.netRevenue), costs: Math.round(p.totalCosts) };
  });
  const maxMix = Math.max(...mix.map((s) => s.revenue), 1);
  const emptyBooks = state.students.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-1">
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
          Centre · {state.settings.city} · {fyLabel(state.settings.fyStartYear, fyStartMonth)} · {monthNames[monthIndex]}
        </p>
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          {state.settings.centreName || "Your centre"}
        </h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {state.settings.instructorName ? `${kit.owner} ${state.settings.instructorName}. ` : ""}
          Active students, paused and returning, renewals, expected tuition, royalty, and profit — on one page.
        </p>
      </div>

      {state.settings.isSample ? (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">Example centre — replace these students with yours when you are ready.</p>
          <button type="button" className="shrink-0 text-left text-sm font-medium text-primary hover:underline" onClick={() => onOpenSheet("settings")}>
            Start a blank year
          </button>
        </div>
      ) : emptyBooks ? (
        <ol className="grid gap-2 sm:grid-cols-3">
          <li>
            <button type="button" onClick={() => onOpenSheet("students")} className="flex h-full w-full gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left">
              <span className="font-mono text-sm text-primary">1</span>
              <span>
                <span className="block font-medium">Add a student</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">Match family names so siblings get the discount.</span>
              </span>
            </button>
          </li>
          <li>
            <button type="button" onClick={() => onOpenSheet("pnl")} className="flex h-full w-full gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left">
              <span className="font-mono text-sm text-primary">2</span>
              <span>
                <span className="block font-medium">Type this month’s costs</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">Royalty calculates from Settings. Grey cells are formulas.</span>
              </span>
            </button>
          </li>
          <li>
            <button type="button" onClick={() => onOpenSheet("desk")} className="flex h-full w-full gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left">
              <span className="font-mono text-sm text-primary">3</span>
              <span>
                <span className="block font-medium">Work the desk</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">Renewals, summer calls, and missed fees appear on their own.</span>
              </span>
            </button>
          </li>
        </ol>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Active students" value={String(pop.active)} hint={`${pop.families} families · ${pop.dualSubject} dual subject`} onClick={() => onOpenSheet("students")} />
        <Kpi label="Paused / away" value={String(pop.paused + pop.away)} hint={`${pop.paused} paused · ${pop.away} marked away`} onClick={() => onOpenSheet("students")} />
        <Kpi label="Returning + waiting" value={String(pop.returning + pop.waiting)} hint={`${pop.returning} returning · ${pop.waiting} on the waiting list`} onClick={() => onOpenSheet("students")} />
        <Kpi label="Renewals due" value={String(renewalsDue)} hint={paymentsDue ? `${paymentsDue} missed fee${paymentsDue === 1 ? "" : "s"} on the desk` : `${returningDue} returning this window`} onClick={() => onOpenSheet("desk")} tone={paymentsDue ? "bad" : undefined} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label={`Expected tuition · ${monthNames[monthIndex]}`}
          value={money(forecast.thisNet, c)}
          hint={`${forecast.thisStudents} billed · ${forecast.thisSubjects} subjects`}
          onClick={() => onOpenSheet("pnl")}
        />
        <Kpi
          label={`Forecast · ${monthNames[forecast.nextIndex]}`}
          value={money(forecast.nextNet, c)}
          hint={`${forecast.nextStudents} billed · ${forecast.starters.length} starter${forecast.starters.length === 1 ? "" : "s"}`}
          onClick={() => onOpenSheet("students")}
        />
        <Kpi
          label={`${kit.royalty} this month`}
          value={money(royalty.thisMonth, c)}
          hint={
            state.settings.licenseFeeMode === "percent"
              ? `${state.settings.licenseFeeRate}% of each subject fee · you keep ${royalty.keepPct.toFixed(2)}%`
              : `${state.settings.licenseFeeRate} per subject · YTD ${money(royalty.ytd, c)}`
          }
          onClick={() => onOpenSheet("settings")}
        />
        <Kpi
          label="Operating profit (YTD)"
          value={money(ytd.operatingProfit, c)}
          hint={`This month ${money(thisMonth.operatingProfit, c)} · FY ${money(fy.operatingProfit, c)}`}
          tone={ytd.operatingProfit >= 0 ? "good" : "bad"}
        />
      </div>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="font-medium">Next month forecast</h3>
          <p className="text-xs text-muted-foreground">
            Waiting-list starts and returning restarts this month and next. Paused students are not billed.
            {forecast.renewalsDue || forecast.summerCalls || forecast.paymentsDue
              ? ` Desk: ${forecast.renewalsDue} renewal${forecast.renewalsDue === 1 ? "" : "s"}, ${forecast.summerCalls} summer call${forecast.summerCalls === 1 ? "" : "s"}, ${forecast.paymentsDue} missed fee${forecast.paymentsDue === 1 ? "" : "s"}.`
              : ""}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          <Pair k="Gross tuition" v={money(forecast.nextGross, c)} />
          <Pair k="Family discount" v={money(-forecast.nextDiscount, c)} />
          <Pair k={kit.royalty} v={money(forecast.nextRoyalty, c)} />
          <Pair k="Net after royalty" v={money(forecast.nextNet - forecast.nextRoyalty, c)} />
        </dl>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ForecastList title="Starting" empty="No waiting-list starts soon" rows={forecast.starters} />
          <ForecastList title="Returning" empty="No restarts dated soon" rows={forecast.returning} />
          <ForecastList title="Leaving this month" empty="No end dates this month" rows={forecast.leavers} />
        </div>
      </section>

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
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 10, fontSize: 12 }}
                  formatter={(value) => money(Number(value ?? 0), c)}
                />
                <Bar dataKey="revenue" name="Net revenue" fill="var(--color-secondary)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="costs" name="Costs" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-medium">Subject mix (billed this month)</h3>
          {mix.every((s) => s.count === 0) ? (
            <p className="mt-4 text-sm text-muted-foreground">No billed students this month.</p>
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
          {levels.length ? (
            <p className="mt-4 text-xs text-muted-foreground">
              Levels: {levels.slice(0, 8).map((l) => `${l.label} (${l.count})`).join(" · ")}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">Average fee {money(avg, c)} · {pop.siblingCount} on family discount</p>
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
            <p className="text-sm text-muted-foreground">No open renewals, summer calls, or missed fees.</p>
          ) : (
            <ul className="divide-y divide-border">
              {desk.slice(0, 8).map((item) => {
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
          <h3 className="font-medium">Royalty, costs, tax</h3>
          <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <Pair k="Gross tuition" v={money(thisMonth.grossTuition, c)} />
            <Pair k="Family discount" v={money(-thisMonth.siblingDiscount, c)} />
            <Pair k={`${kit.royalty} (${monthNames[monthIndex]})`} v={money(thisMonth.licenseFee, c)} />
            <Pair k={`${kit.royalty} YTD`} v={money(ytd.licenseFee, c)} />
            {ytd.initialLicense > 0 ? <Pair k="Initial licence (one-off)" v={money(ytd.initialLicense, c)} /> : null}
            <Pair k="Total costs YTD" v={money(ytd.totalCosts, c)} />
            <Pair k="Tax payable" v={money(tax.taxPayable, c)} />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            {deltaHint(mom.revenueDelta, mom.revenuePct, c)} vs last month. Royalty % is in Settings. Initial licence is a one-off on the P&L.
          </p>
        </section>
      </div>
    </div>
  );
}

function ForecastList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: { id: string; name: string; date: string }[];
}) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
        {title} <span className="font-mono">{rows.length}</span>
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {rows.slice(0, 5).map((row) => (
            <li key={row.id} className="flex justify-between gap-2 text-sm">
              <span className="truncate">{row.name}</span>
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{row.date.slice(5)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function deltaHint(delta: number | null, pct: number | null, currency: Parameters<typeof money>[1]) {
  if (delta == null) return "First month of the year";
  const sign = delta > 0 ? "+" : "";
  const p = pct == null ? "" : ` (${sign}${pct.toFixed(0)}%)`;
  return `${sign}${money(delta, currency)}${p}`;
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

function Pair({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border py-1.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono tabular-nums">{v}</dd>
    </div>
  );
}
