import { useMemo, useState } from "react";
import { Plus, RotateCcw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AmountCell } from "./AmountCell";
import { ExcelGrid, GridRow, MonthCell, SectionRow } from "./ExcelGrid";
import { fyMonths } from "@/lib/ledger/types";
import { licenseFeeSeries, monthPnL, sum, tuitionSeries, yearPnL } from "@/lib/ledger/calc";
import { fyYearLabels, money } from "@/lib/ledger/format";
import { kitOf } from "@/lib/ledger/kits";
import { useLedger } from "@/lib/ledger/store";

type Sel = { row: string; month: number; formula: string; hint: string } | null;

export function PnlSheet() {
  const state = useLedger();
  const currency = state.settings.currency;
  const kit = kitOf(state.settings.tradeId);
  const showRoyalty = state.settings.licenseFeeRate > 0;
  const showDiscount = state.settings.siblingDiscountPct > 0;
  const fyStartMonth = state.settings.fyStartMonth ?? 3;
  const monthNames = fyMonths(fyStartMonth);
  const yearLabels = fyYearLabels(state.settings.fyStartYear, fyStartMonth);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => monthPnL(state, i)), [state]);
  const ytd = useMemo(() => yearPnL(state), [state]);
  const tuition = useMemo(() => tuitionSeries(state), [state]);
  const license = useMemo(() => licenseFeeSeries(state), [state]);
  const [sel, setSel] = useState<Sel>(null);
  const [newRow, setNewRow] = useState("");

  const licenseHint =
    state.settings.licenseFeeMode === "percent"
      ? `${state.settings.licenseFeeRate}% of each ${kit.offering.toLowerCase()} fee (${state.settings.licenseFeeBase === "net" ? "after family discount" : "before family discount"})`
      : `${state.settings.licenseFeeRate} per billed ${kit.offering.toLowerCase()}`;

  function select(row: string, month: number, formula: string, hint: string) {
    setSel({ row, month, formula, hint });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3 py-2 sm:flex-row sm:items-center">
        <div className="flex min-h-10 flex-1 items-center gap-2 font-mono text-[13px]">
          <span className="rounded-sm bg-formula px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-primary-foreground">
            fx
          </span>
          <span className="truncate text-formula">
            {sel?.formula ?? "Select a cell to see how it is calculated"}
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground sm:max-w-xs sm:text-right">
          {sel?.hint ?? "Grey cells are formulas. White cells are yours to type."}
        </p>
      </div>

      <ExcelGrid yearLabels={yearLabels} months={monthNames}>
        <SectionRow label="Revenue" />
        <GridRow
          label={`${kit.revenue} (gross)`}
          hint={`From the ${kit.customers.toLowerCase()} register · click a month to override`}
          variant="formula"
          ytd={money(ytd.grossTuition, currency)}
        >
          {months.map((m, i) => (
            <MonthCell key={i} selected={sel?.row === "tuition" && sel.month === i}>
              <AmountCell
                value={m.grossTuition}
                currency={currency}
                editable
                selected={sel?.row === "tuition" && sel.month === i}
                onSelect={() =>
                  select(
                    "tuition",
                    i,
                    state.tuitionOverrides[i] != null
                      ? `Manual override (${monthNames[i]})`
                      : `= Σ (active ${kit.customers.toLowerCase()} × ${kit.offeringsLabel.toLowerCase()} × fee) · ${monthNames[i]}`,
                    state.tuitionOverrides[i] != null
                      ? "Override on — reset to use the register"
                      : `${tuition.enrolment[i].studentCount} ${kit.customers.toLowerCase()} · ${tuition.enrolment[i].subjectCount} ${kit.offeringsLabel.toLowerCase()}`,
                  )
                }
                onChange={(v) => state.setTuitionOverride(i, v)}
              />
            </MonthCell>
          ))}
        </GridRow>
        {showDiscount ? (
        <GridRow
          label={kit.discount}
          hint={`${state.settings.siblingDiscountPct}% on second+ in a ${kit.group.toLowerCase()}`}
          variant="formula"
          ytd={<span className="text-loss">{money(-ytd.siblingDiscount, currency)}</span>}
        >
          {months.map((m, i) => (
            <MonthCell key={i} selected={sel?.row === "discount" && sel.month === i}>
              <AmountCell
                value={-m.siblingDiscount}
                currency={currency}
                editable
                negative
                selected={sel?.row === "discount" && sel.month === i}
                onSelect={() =>
                  select(
                    "discount",
                    i,
                    state.discountOverrides[i] != null
                      ? `Manual override (${monthNames[i]})`
                      : `= Sibling tuition × ${state.settings.siblingDiscountPct}%`,
                    `${tuition.enrolment[i].siblingCount} discounted enrolments`,
                  )
                }
                onChange={(v) => state.setDiscountOverride(i, Math.abs(v))}
              />
            </MonthCell>
          ))}
        </GridRow>
        ) : null}
        <GridRow
          label={kit.extra.registration}
          ytd={money(ytd.registration, currency)}
        >
          {months.map((m, i) => (
            <MonthCell key={i} selected={sel?.row === "reg" && sel.month === i}>
              <AmountCell
                value={m.registration}
                currency={currency}
                editable
                onSelect={() => select("reg", i, "Manual entry", kit.extra.registration)}
                onChange={(v) => state.setExtraRevenue("registration", i, v)}
              />
            </MonthCell>
          ))}
        </GridRow>
        <GridRow label={kit.extra.materials} ytd={money(ytd.materials, currency)}>
          {months.map((m, i) => (
            <MonthCell key={i} selected={sel?.row === "mat" && sel.month === i}>
              <AmountCell
                value={m.materials}
                currency={currency}
                editable
                onSelect={() => select("mat", i, "Manual entry", kit.extra.materials)}
                onChange={(v) => state.setExtraRevenue("materials", i, v)}
              />
            </MonthCell>
          ))}
        </GridRow>
        <GridRow label={kit.extra.other} ytd={money(ytd.otherIncome, currency)}>
          {months.map((m, i) => (
            <MonthCell key={i} selected={sel?.row === "oth" && sel.month === i}>
              <AmountCell
                value={m.otherIncome}
                currency={currency}
                editable
                onSelect={() => select("oth", i, "Manual entry", "Events, late fees, other")}
                onChange={(v) => state.setExtraRevenue("other", i, v)}
              />
            </MonthCell>
          ))}
        </GridRow>
        <GridRow label="Net revenue" variant="total" ytd={money(ytd.netRevenue, currency)}>
          {months.map((m, i) => (
            <MonthCell key={i}>
              <AmountCell value={m.netRevenue} currency={currency} bold />
            </MonthCell>
          ))}
        </GridRow>

        <SectionRow label="Costs" />
        <GridRow
          label="Initial licence fee (one-off)"
          hint="Paid at the start — type the amount in the month you paid. Not the monthly royalty."
          ytd={money(ytd.initialLicense, currency)}
        >
          {months.map((m, i) => (
            <MonthCell key={i} selected={sel?.row === "initlic" && sel.month === i}>
              <AmountCell
                value={m.initialLicense}
                currency={currency}
                editable
                selected={sel?.row === "initlic" && sel.month === i}
                onSelect={() =>
                  select(
                    "initlic",
                    i,
                    "One-off licence / franchise fee",
                    "Type here or in Settings. Royalty is the next row.",
                  )
                }
                onChange={(v) => state.setInitialLicense(i, v)}
              />
            </MonthCell>
          ))}
        </GridRow>
        {showRoyalty ? (
        <GridRow
          label={kit.royalty}
          hint={licenseHint}
          variant="formula"
          ytd={money(ytd.licenseFee, currency)}
          trailing={
            state.tuitionOverrides.some((v) => v != null) || state.discountOverrides.some((v) => v != null) ? (
              <button
                type="button"
                className="hidden text-muted-foreground hover:text-foreground sm:block"
                title="Clear tuition overrides"
                onClick={() => {
                  monthNames.forEach((_, i) => {
                    state.setTuitionOverride(i, null);
                    state.setDiscountOverride(i, null);
                  });
                }}
              >
                <RotateCcw className="size-3.5" />
              </button>
            ) : null
          }
        >
          {months.map((m, i) => (
            <MonthCell key={i} selected={sel?.row === "lic" && sel.month === i}>
              <AmountCell
                value={m.licenseFee}
                currency={currency}
                muted
                selected={sel?.row === "lic" && sel.month === i}
                onSelect={() =>
                  select(
                    "lic",
                    i,
                    state.settings.licenseFeeMode === "percent"
                      ? `= Σ (${kit.offering.toLowerCase()} fee × ${state.settings.licenseFeeRate}%) · ${tuition.enrolment[i].subjectCount} ${kit.offeringsLabel.toLowerCase()}`
                      : `= ${tuition.enrolment[i].subjectCount} ${kit.offeringsLabel.toLowerCase()} × ${state.settings.licenseFeeRate}`,
                    "Royalty is monthly and follows Settings. The one-off licence is the row above.",
                  )
                }
              />
            </MonthCell>
          ))}
        </GridRow>
        ) : null}
        {state.expenses.map((row) => (
          <GridRow
            key={row.id}
            label={
              row.kind === "custom" ? (
                <input
                  value={row.name}
                  onChange={(e) => state.renameExpenseRow(row.id, e.target.value)}
                  className="w-full bg-transparent text-[13px] outline-none"
                />
              ) : (
                row.name
              )
            }
            ytd={money(sum(row.values), currency)}
            trailing={
              <span className="flex items-center gap-0.5 opacity-70 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                <button
                  type="button"
                  title="Copy this month across the rest of the year"
                  className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => state.fillExpenseRow(row.id, sel?.row === row.id ? sel.month : 0)}
                >
                  <Copy className="size-3.5" />
                </button>
                {row.kind === "custom" ? (
                  <button
                    type="button"
                    className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-loss"
                    onClick={() => state.removeExpenseRow(row.id)}
                  >
                    ×
                  </button>
                ) : null}
              </span>
            }
          >
            {row.values.map((v, i) => (
              <MonthCell key={i} selected={sel?.row === row.id && sel.month === i}>
                <AmountCell
                  value={v}
                  currency={currency}
                  editable
                  selected={sel?.row === row.id && sel.month === i}
                  onSelect={() => select(row.id, i, "Manual entry", `${row.name} · ${monthNames[i]}`)}
                  onChange={(n) => state.setExpenseValue(row.id, i, n)}
                />
              </MonthCell>
            ))}
          </GridRow>
        ))}
        <GridRow
          label="Amortisation"
          hint="Straight-line from the fixed asset register"
          variant="formula"
          ytd={money(ytd.amortisation, currency)}
        >
          {months.map((m, i) => (
            <MonthCell key={i} selected={sel?.row === "amort" && sel.month === i}>
              <AmountCell
                value={m.amortisation}
                currency={currency}
                muted
                selected={sel?.row === "amort" && sel.month === i}
                onSelect={() =>
                  select(
                    "amort",
                    i,
                    "= Σ (cost − residual) / (life × 12) for assets owned this month",
                    "Edit on the Assets sheet",
                  )
                }
              />
            </MonthCell>
          ))}
        </GridRow>
        <GridRow label="Total costs" variant="total" ytd={money(ytd.totalCosts, currency)}>
          {months.map((m, i) => (
            <MonthCell key={i}>
              <AmountCell value={m.totalCosts} currency={currency} bold />
            </MonthCell>
          ))}
        </GridRow>
        <GridRow
          label="Operating profit"
          variant="grand"
          ytd={
            <span className={ytd.operatingProfit >= 0 ? "text-profit" : "text-loss"}>
              {money(ytd.operatingProfit, currency)}
            </span>
          }
        >
          {months.map((m, i) => (
            <MonthCell key={i}>
              <span
                className={`flex h-10 items-center justify-end px-2 font-mono text-[13px] font-medium tabular-nums ${m.operatingProfit >= 0 ? "text-profit" : "text-loss"}`}
              >
                {money(m.operatingProfit, currency)}
              </span>
            </MonthCell>
          ))}
        </GridRow>
      </ExcelGrid>

      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!newRow.trim()) return;
          state.addExpenseRow(newRow);
          setNewRow("");
        }}
      >
        <input
          value={newRow}
          onChange={(e) => setNewRow(e.target.value)}
          placeholder="Add a cost line (cleaning, insurance, software…)"
          className="h-11 flex-1 rounded-lg border border-border bg-card px-3 text-sm"
        />
        <Button type="submit" variant="outline" className="h-11">
          <Plus className="size-4" />
          Add row
        </Button>
      </form>
      <p className="text-[12px] text-muted-foreground">
        {showRoyalty ? `${kit.royalty} this year ${money(sum(license), currency)} · ` : ""}
        Hover a cost row and tap the copy icon to fill later months.
      </p>
    </div>
  );
}
