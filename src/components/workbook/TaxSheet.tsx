import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { computeTax } from "@/lib/ledger/calc";
import { money } from "@/lib/ledger/format";
import { useLedger } from "@/lib/ledger/store";
import type { CurrencyCode } from "@/lib/ledger/types";

export function TaxSheet() {
  const state = useLedger();
  const tax = computeTax(state);
  const c = state.settings.currency;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Tax computation</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Starts from operating profit, adds back book amortisation and disallowed items, then deducts tax depreciation on the WDV method. Rates are in Settings — this is a working paper for your CA, not a filed return.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <tbody>
              <TaxRow label="Profit before tax (as per P&L)" amount={tax.profitBeforeTax} currency={c} />
              <TaxRow label="Add: disallowed expenses" amount={tax.disallowed} currency={c} />
              <TaxRow label="Add: amortisation per books" amount={tax.bookAmortisation} currency={c} hint="Replaced by tax depreciation below" />
              <TaxRow label="Less: depreciation as per tax (WDV)" amount={-tax.taxDepreciation} currency={c} />
              <TaxRow label="Less: other deductions" amount={-tax.otherDeductions} currency={c} />
              <TaxRow label="Taxable income" amount={tax.taxableIncome} currency={c} emphasis />
              <TaxRow label={`Income tax @ ${state.settings.taxRatePct}%`} amount={tax.incomeTax} currency={c} />
              <TaxRow label={`Health & education cess @ ${state.settings.cessPct}%`} amount={tax.cess} currency={c} />
              <TaxRow label="Total tax" amount={tax.totalTax} currency={c} emphasis />
              <TaxRow label="Less: advance tax" amount={-tax.advanceTax} currency={c} />
              <TaxRow label="Less: TDS" amount={-tax.tds} currency={c} />
              <tr className="bg-primary text-primary-foreground">
                <td className="px-4 py-3 font-medium">Tax payable / (refund)</td>
                <td className="px-4 py-3 text-right font-mono text-base font-medium tabular-nums">
                  {money(tax.taxPayable, c)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-[13px] font-semibold tracking-wide uppercase">Add-backs (disallowed)</h3>
            <div className="mt-3 space-y-2">
              {state.tax.disallowed.map((line) => (
                <LineEditor
                  key={line.id}
                  name={line.name}
                  amount={line.amount}
                  onName={(name) => state.updateTaxLine("disallowed", line.id, { name })}
                  onAmount={(amount) => state.updateTaxLine("disallowed", line.id, { amount })}
                  onRemove={() => state.removeTaxLine("disallowed", line.id)}
                />
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => state.addTaxLine("disallowed")}>
              <Plus className="size-3.5" /> Add line
            </Button>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-[13px] font-semibold tracking-wide uppercase">Other deductions</h3>
            <div className="mt-3 space-y-2">
              {state.tax.deductions.map((line) => (
                <LineEditor
                  key={line.id}
                  name={line.name}
                  amount={line.amount}
                  onName={(name) => state.updateTaxLine("deductions", line.id, { name })}
                  onAmount={(amount) => state.updateTaxLine("deductions", line.id, { amount })}
                  onRemove={() => state.removeTaxLine("deductions", line.id)}
                />
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => state.addTaxLine("deductions")}>
              <Plus className="size-3.5" /> Add line
            </Button>
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-[13px] font-semibold tracking-wide uppercase">Taxes already paid</h3>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-[13px]">
                Advance tax
                <Input
                  inputMode="decimal"
                  value={state.tax.advanceTax}
                  onChange={(e) => state.setTaxPaid({ advanceTax: Number(e.target.value) || 0 })}
                />
              </label>
              <label className="grid gap-1 text-[13px]">
                TDS
                <Input
                  inputMode="decimal"
                  value={state.tax.tds}
                  onChange={(e) => state.setTaxPaid({ tds: Number(e.target.value) || 0 })}
                />
              </label>
            </div>
          </section>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <header className="border-b border-border px-4 py-3">
          <h3 className="text-[13px] font-semibold tracking-wide uppercase">Tax depreciation schedule (WDV)</h3>
        </header>
        <div className="sheet-scroll overflow-auto">
          <table className="xl-grid min-w-[720px] w-full text-sm">
            <thead>
              <tr className="bg-colhead text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2 text-left">Asset</th>
                <th className="px-3 py-2 text-right">Opening / cost</th>
                <th className="px-3 py-2 text-right">Depreciation</th>
                <th className="px-3 py-2 text-right">Closing WDV</th>
              </tr>
            </thead>
            <tbody>
              {tax.assetTax.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2">
                    {a.name}
                    {a.halfRate ? <span className="ml-2 text-[11px] text-muted-foreground">180-day half rate</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{money(a.opening, c)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{money(a.depreciation, c)}</td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{money(a.closing, c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function TaxRow({
  label,
  amount,
  currency,
  emphasis,
  hint,
}: {
  label: string;
  amount: number;
  currency: CurrencyCode;
  emphasis?: boolean;
  hint?: string;
}) {
  return (
    <tr className={emphasis ? "bg-muted/60" : "border-b border-border"}>
      <td className="px-4 py-2.5">
        <div className={emphasis ? "font-medium" : ""}>{label}</div>
        {hint ? <div className="text-[11px] text-muted-foreground">{hint}</div> : null}
      </td>
      <td className={`px-4 py-2.5 text-right font-mono tabular-nums ${amount < 0 ? "text-loss" : ""} ${emphasis ? "font-medium" : ""}`}>
        {money(amount, currency)}
      </td>
    </tr>
  );
}

function LineEditor({
  name,
  amount,
  onName,
  onAmount,
  onRemove,
}: {
  name: string;
  amount: number;
  onName: (n: string) => void;
  onAmount: (n: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Input value={name} onChange={(e) => onName(e.target.value)} className="flex-1" />
      <Input
        inputMode="decimal"
        value={amount}
        onChange={(e) => onAmount(Number(e.target.value) || 0)}
        className="w-28"
      />
      <button type="button" className="grid size-10 place-items-center rounded-md hover:bg-muted" onClick={onRemove}>
        <Trash2 className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
}
