import { useState } from "react";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { assetPosition, sum, taxDepreciationForAsset, yearPnL } from "@/lib/ledger/calc";
import { money } from "@/lib/ledger/format";
import { defaultAsset, useLedger } from "@/lib/ledger/store";
import {
  ASSET_CATEGORY_LABEL,
  TAX_WDV_RATES,
  type AssetCategory,
  type FixedAsset,
} from "@/lib/ledger/types";

export function AssetsSheet() {
  const ledger = useLedger();
  const assets = ledger.assets;
  const settings = ledger.settings;
  const addAsset = ledger.addAsset;
  const updateAsset = ledger.updateAsset;
  const removeAsset = ledger.removeAsset;
  const y = yearPnL(ledger);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FixedAsset | null>(null);
  const [draft, setDraft] = useState(defaultAsset());

  const totalCost = sum(assets.map((a) => a.cost));
  const totalNbv = sum(assets.map((a) => assetPosition(a, settings.fyStartYear, settings.fyStartMonth ?? 3).nbv));

  function openNew() {
    setEditing(null);
    setDraft(defaultAsset());
    setOpen(true);
  }

  function openEdit(a: FixedAsset) {
    setEditing(a);
    setDraft({ ...a });
    setOpen(true);
  }

  function save() {
    if (!draft.name.trim() || draft.cost <= 0) return;
    const payload = {
      ...draft,
      taxOpeningWdv: draft.taxOpeningWdv || draft.cost,
      taxWdvRatePct: draft.taxWdvRatePct || TAX_WDV_RATES[draft.category],
    };
    if (editing) updateAsset(editing.id, payload);
    else addAsset(payload);
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Fixed asset register</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Straight-line amortisation posts monthly into the P&L. Tax uses written-down value rates (half rate if used under 180 days in the year of purchase).
          </p>
        </div>
        <Button onClick={openNew} className="h-11">
          <Plus className="size-4" />
          Add asset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Gross block" value={money(totalCost, settings.currency)} />
        <Stat label="Net block (NBV)" value={money(totalNbv, settings.currency)} />
        <Stat label="Books amort (FY)" value={money(y.amortisation, settings.currency)} />
        <Stat label="Assets" value={String(assets.length)} />
      </div>

      {assets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <Landmark className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Register is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add furniture, computers, AC, signage — amortisation will flow to costs.
          </p>
        </div>
      ) : (
        <div className="sheet-scroll overflow-auto rounded-xl border border-border bg-card">
          <table className="xl-grid min-w-[920px] w-full text-sm">
            <thead>
              <tr className="bg-colhead text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                <th className="px-3 py-2 text-left">Asset</th>
                <th className="px-3 py-2 text-left">Purchased</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2 text-right">Life</th>
                <th className="px-3 py-2 text-right">FY amort</th>
                <th className="px-3 py-2 text-right">Accum.</th>
                <th className="px-3 py-2 text-right">NBV</th>
                <th className="px-3 py-2 text-right">Tax dep</th>
                <th className="px-3 py-2 text-right">WDV</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const books = assetPosition(a, settings.fyStartYear, settings.fyStartMonth ?? 3);
                const tax = taxDepreciationForAsset(a, settings.fyStartYear, settings.fyStartMonth ?? 3);
                return (
                  <tr key={a.id} className="hover:bg-muted/40">
                    <td className="px-3 py-2">
                      <button type="button" className="text-left" onClick={() => openEdit(a)}>
                        <div className="font-medium">{a.name}</div>
                        <div className="text-[11px] text-muted-foreground">{ASSET_CATEGORY_LABEL[a.category]}</div>
                      </button>
                    </td>
                    <td className="px-3 py-2 font-mono text-[12px] tabular-nums">{a.purchaseDate}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{money(a.cost, settings.currency)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{a.usefulLifeYears}y</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{money(books.yearCharge, settings.currency)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{money(books.closingAccum, settings.currency)}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium tabular-nums">{money(books.nbv, settings.currency)}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {money(tax.depreciation, settings.currency)}
                      {tax.halfRate ? <span className="block text-[10px] text-muted-foreground">half rate</span> : null}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">{money(tax.closingWdv, settings.currency)}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-loss"
                        onClick={() => removeAsset(a.id)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={editing ? "Edit asset" : "Add asset"}
          description="Books use straight line. Tax uses WDV on the opening written-down value."
        >
          <div className="grid gap-3">
            <label className="grid gap-1">
              <Label>Name</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <Label>Category</Label>
                <NativeSelect
                  value={draft.category}
                  onChange={(e) => {
                    const category = e.target.value as AssetCategory;
                    setDraft({
                      ...draft,
                      category,
                      taxWdvRatePct: TAX_WDV_RATES[category],
                      usefulLifeYears: category === "computers" ? 3 : draft.usefulLifeYears,
                    });
                  }}
                >
                  {(Object.keys(ASSET_CATEGORY_LABEL) as AssetCategory[]).map((k) => (
                    <option key={k} value={k}>
                      {ASSET_CATEGORY_LABEL[k]}
                    </option>
                  ))}
                </NativeSelect>
              </label>
              <label className="grid gap-1">
                <Label>Purchase date</Label>
                <Input type="date" value={draft.purchaseDate} onChange={(e) => setDraft({ ...draft, purchaseDate: e.target.value })} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Num label="Cost" value={draft.cost} onChange={(cost) => setDraft({ ...draft, cost, taxOpeningWdv: draft.taxOpeningWdv || cost })} />
              <Num label="Residual value" value={draft.residualValue} onChange={(residualValue) => setDraft({ ...draft, residualValue })} />
              <Num label="Useful life (years)" value={draft.usefulLifeYears} onChange={(usefulLifeYears) => setDraft({ ...draft, usefulLifeYears })} />
              <Num label="Tax WDV rate %" value={draft.taxWdvRatePct} onChange={(taxWdvRatePct) => setDraft({ ...draft, taxWdvRatePct })} />
              <Num label="Opening WDV (tax)" value={draft.taxOpeningWdv} onChange={(taxOpeningWdv) => setDraft({ ...draft, taxOpeningWdv })} />
            </div>
            <p className="text-[12px] text-muted-foreground">
              Opening WDV is used when the asset was bought in a prior year. For a purchase in this FY, tax starts from cost (half rate if used under 180 days).
            </p>
            <div className="flex justify-end gap-2">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3">
      <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-mono text-lg font-medium tabular-nums">{value}</p>
    </div>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <label className="grid gap-1">
      <Label>{label}</Label>
      <Input inputMode="decimal" value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
    </label>
  );
}
