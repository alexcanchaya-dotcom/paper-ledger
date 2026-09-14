import { useState } from "react";
import {
  BookOpen,
  Briefcase,
  Coffee,
  Dumbbell,
  GraduationCap,
  Scissors,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { RestorePanel } from "@/components/workbook/RestorePanel";
import { TRADE_LIST, createKitLedger, type KitDef } from "@/lib/ledger/kits";
import { useLedger } from "@/lib/ledger/store";
import type { CurrencyCode, LedgerState, TradeId } from "@/lib/ledger/types";

const ICONS: Record<TradeId, typeof BookOpen> = {
  tuition: GraduationCap,
  salon: Scissors,
  studio: Dumbbell,
  services: Briefcase,
  cafe: Coffee,
  shop: Store,
};

export function Onboarding({ ready = true }: { ready?: boolean }) {
  const replaceAll = useLedger((s) => s.replaceAll);
  const [trade, setTrade] = useState<TradeId>("tuition");
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [city, setCity] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("EUR");
  const kit = TRADE_LIST.find((k) => k.id === trade) as KitDef;

  function start(sample: boolean) {
    replaceAll(
      createKitLedger({
        trade,
        sample,
        name: name || kit.exampleName,
        owner: owner || (sample ? kit.exampleOwner : ""),
        city: city || (sample ? kit.exampleCity : ""),
        currency,
      }),
    );
  }

  function applyRestore(ledger: LedgerState) {
    const at = new Date().toISOString();
    replaceAll({
      ...ledger,
      settings: { ...ledger.settings, onboarded: true, isSample: false, lastBackupAt: at },
    });
  }

  return (
    <div className="min-h-dvh px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="size-5" />
          </div>
          <div>
            <p className="font-display text-2xl font-semibold tracking-tight">Paper Ledger</p>
            <p className="text-[13px] text-muted-foreground">The books for a small business</p>
          </div>
        </div>

        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Pick a kit. Start keeping books today.
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
          A register, a spreadsheet P&L, a desk for follow-ups, assets, a tax working paper, and a real Excel file for your accountant. Tuition & coaching is the deepest kit — the others share the same books. Figures stay in this browser until you save a backup.
        </p>

        <ul className="mt-8 grid gap-2 sm:grid-cols-2">
          {TRADE_LIST.map((k) => {
            const Icon = ICONS[k.id];
            const on = trade === k.id;
            const flagship = k.id === "tuition";
            return (
              <li key={k.id}>
                <button
                  type="button"
                  onClick={() => setTrade(k.id)}
                  className={`flex h-full w-full gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150 ${
                    on
                      ? "border-primary bg-card text-foreground"
                      : "border-border bg-card/60 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  <Icon className="mt-0.5 size-5 shrink-0" />
                  <span>
                    <span className="block font-medium text-foreground">
                      {k.name}
                      {flagship ? (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-primary uppercase">
                          Flagship
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[13px] leading-snug">{k.blurb}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-4 text-[13px] text-muted-foreground">
          This kit: {kit.customers.toLowerCase()} on a monthly plan
          {kit.siblingDiscountPct ? ` · ${kit.discount.toLowerCase()} ${kit.siblingDiscountPct}%` : ""}
          {kit.licenseFeeRate ? ` · ${kit.royalty.toLowerCase()} ${kit.licenseFeeRate}% per ${kit.offering.toLowerCase()}` : ""}
          {" · "}
          {kit.fyStartMonth === 0 ? "calendar year" : "April–March year"}.
        </p>

        <div className="mt-6 grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
          <label className="grid gap-1 sm:col-span-2">
            <Label>Business name</Label>
            <Input value={name} placeholder={kit.exampleName} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <Label>Your name</Label>
            <Input value={owner} placeholder={kit.exampleOwner} onChange={(e) => setOwner(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <Label>City</Label>
            <Input value={city} placeholder={kit.exampleCity} onChange={(e) => setCity(e.target.value)} />
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <Label>Currency</Label>
            <NativeSelect value={currency} onChange={(e) => setCurrency(e.target.value as CurrencyCode)}>
              <option value="EUR">EUR — Euro</option>
              <option value="INR">INR — Indian rupee</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="AUD">AUD</option>
              <option value="SGD">SGD</option>
            </NativeSelect>
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button className="h-11 sm:flex-1" disabled={!ready} onClick={() => start(true)}>
            Start with example figures
          </Button>
          <Button variant="outline" className="h-11 sm:flex-1" disabled={!ready} onClick={() => start(false)}>
            Start empty
          </Button>
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground">
          {ready
            ? "Example figures are there so you can click around. Export gives you Excel for the accountant and a .json backup you can open on another computer. Excel will not restore the live books."
            : "Opening books already stored in this browser…"}
        </p>
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-sm font-medium">Already have a backup from another device?</p>
          <p className="mt-1 mb-3 text-xs text-muted-foreground">
            Use the .json file from Save backup. An Excel workbook will be refused.
          </p>
          <div className={ready ? undefined : "pointer-events-none opacity-50"}>
            <RestorePanel onRestore={applyRestore} confirmLabel="Open these books" />
          </div>
        </div>
      </div>
    </div>
  );
}
