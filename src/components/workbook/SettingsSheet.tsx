import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { TRADE_LIST, createKitLedger, createUnboardedLedger, kitOf } from "@/lib/ledger/kits";
import { useLedger } from "@/lib/ledger/store";
import { uid } from "@/lib/utils";
import type { CurrencyCode, FyStartMonth, LicenseFeeBase, LicenseFeeMode, TradeId } from "@/lib/ledger/types";

export function SettingsSheet() {
  const settings = useLedger((s) => s.settings);
  const kit = kitOf(settings.tradeId);
  const patch = useLedger((s) => s.patchSettings);
  const replaceAll = useLedger((s) => s.replaceAll);
  const offerings = settings.offerings?.length ? settings.offerings : kit.offerings;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          {kit.blurb} Royalty and family discounts can sit at 0 if you do not use them.
        </p>
      </div>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <Field label="Business name">
          <Input value={settings.centreName} onChange={(e) => patch({ centreName: e.target.value })} />
        </Field>
        <Field label="Your name">
          <Input value={settings.instructorName} onChange={(e) => patch({ instructorName: e.target.value })} />
        </Field>
        <Field label="Business type">
          <NativeSelect
            value={settings.tradeId ?? "tuition"}
            onChange={(e) => {
              const next = kitOf(e.target.value as TradeId);
              patch({
                tradeId: next.id,
                offerings: next.offerings,
                licenseFeeRate: next.licenseFeeRate,
                siblingDiscountPct: next.siblingDiscountPct,
                defaultMathFee: next.defaultFee,
                defaultEnglishFee: next.defaultFee,
                fyStartMonth: next.fyStartMonth,
              });
            }}
          >
            {TRADE_LIST.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="City">
          <Input value={settings.city} onChange={(e) => patch({ city: e.target.value })} />
        </Field>
        <Field label="Financial year">
          <Input
            inputMode="numeric"
            value={settings.fyStartYear}
            onChange={(e) => patch({ fyStartYear: Number(e.target.value) || settings.fyStartYear })}
          />
        </Field>
        <Field label="Year begins">
          <NativeSelect
            value={String(settings.fyStartMonth ?? 3)}
            onChange={(e) => patch({ fyStartMonth: Number(e.target.value) as FyStartMonth })}
          >
            <option value="0">January (calendar year)</option>
            <option value="3">April (India FY)</option>
          </NativeSelect>
        </Field>
        <Field label="Currency">
          <NativeSelect
            value={settings.currency}
            onChange={(e) => patch({ currency: e.target.value as CurrencyCode })}
          >
            <option value="EUR">EUR — Euro</option>
            <option value="INR">INR — Indian rupee</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="AUD">AUD</option>
            <option value="SGD">SGD</option>
          </NativeSelect>
        </Field>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-medium">{kit.offeringsLabel}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          These appear on each {kit.customer.toLowerCase()} record and drive monthly {kit.revenue.toLowerCase()}.
        </p>
        <ul className="mt-3 space-y-2">
          {offerings.map((o, i) => (
            <li key={o.id} className="flex gap-2">
              <Input
                value={o.label}
                onChange={(e) =>
                  patch({
                    offerings: offerings.map((x) => (x.id === o.id ? { ...x, label: e.target.value } : x)),
                  })
                }
              />
              {offerings.length > 1 ? (
                <button
                  type="button"
                  className="grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-loss"
                  onClick={() => patch({ offerings: offerings.filter((x) => x.id !== o.id) })}
                  aria-label={`Remove ${o.label}`}
                >
                  <Trash2 className="size-4" />
                </button>
              ) : null}
              {i === offerings.length - 1 ? (
                <button
                  type="button"
                  className="grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() =>
                    patch({
                      offerings: [...offerings, { id: uid("off"), label: `New ${kit.offering.toLowerCase()}` }],
                    })
                  }
                  aria-label={`Add ${kit.offering.toLowerCase()}`}
                >
                  <Plus className="size-4" />
                </button>
              ) : (
                <span className="size-10 shrink-0" />
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {kit.id === "tuition" ? (
            <>
              <Field label="Default Math fee / month">
                <Input
                  inputMode="decimal"
                  value={settings.defaultMathFee}
                  onChange={(e) => patch({ defaultMathFee: Number(e.target.value) || 0 })}
                />
              </Field>
              <Field label="Default English fee / month">
                <Input
                  inputMode="decimal"
                  value={settings.defaultEnglishFee}
                  onChange={(e) => patch({ defaultEnglishFee: Number(e.target.value) || 0 })}
                />
              </Field>
            </>
          ) : (
            <Field label={`Default fee per ${kit.offering.toLowerCase()} / month`}>
              <Input
                inputMode="decimal"
                value={settings.defaultMathFee}
                onChange={(e) =>
                  patch({
                    defaultMathFee: Number(e.target.value) || 0,
                    defaultEnglishFee: Number(e.target.value) || 0,
                  })
                }
              />
            </Field>
          )}
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <h3 className="font-medium sm:col-span-2">
          {kit.id === "tuition" ? "Franchise royalty & family discount" : `Revenue & ${kit.royalty.toLowerCase()}`}
        </h3>
        {kit.id === "tuition" ? (
          <p className="text-sm text-muted-foreground sm:col-span-2">
            Kumon centres typically pay 33.75% of gross tuition. Set the % here — the P&L, Centre dashboard, and Excel royalty sheet all follow. Put 0 if you are independent.
          </p>
        ) : null}
        <Field label={`${kit.royalty} mode`}>
          <NativeSelect
            value={settings.licenseFeeMode}
            onChange={(e) => patch({ licenseFeeMode: e.target.value as LicenseFeeMode })}
          >
            <option value="percent">Percentage of {kit.revenue.toLowerCase()}</option>
            <option value="per_subject">Fixed amount per {kit.offering.toLowerCase()}</option>
          </NativeSelect>
        </Field>
        <Field
          label={
            settings.licenseFeeMode === "percent"
              ? `${kit.royalty} % (0 if none)`
              : `${kit.royalty} per ${kit.offering.toLowerCase()}`
          }
        >
          <Input
            inputMode="decimal"
            value={settings.licenseFeeRate}
            onChange={(e) => patch({ licenseFeeRate: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Calculated on">
          <NativeSelect
            value={settings.licenseFeeBase}
            onChange={(e) => patch({ licenseFeeBase: e.target.value as LicenseFeeBase })}
          >
            <option value="gross">Gross {kit.revenue.toLowerCase()} (before discount)</option>
            <option value="net">Net {kit.revenue.toLowerCase()} (after discount)</option>
          </NativeSelect>
        </Field>
        <Field label={`${kit.discount} % (0 if none)`}>
          <Input
            inputMode="decimal"
            value={settings.siblingDiscountPct}
            onChange={(e) => patch({ siblingDiscountPct: Number(e.target.value) || 0 })}
          />
        </Field>
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <h3 className="font-medium sm:col-span-2">Desk</h3>
        <Field label="Warn of renewals this many days ahead">
          <Input
            inputMode="numeric"
            value={settings.renewalNoticeDays ?? 45}
            onChange={(e) => patch({ renewalNoticeDays: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Term restart / after-pause call date">
          <Input
            type="date"
            value={settings.summerReturnDate ?? ""}
            onChange={(e) => patch({ summerReturnDate: e.target.value })}
          />
        </Field>
        {kit.id === "tuition" ? (
          <Field label="Missed-fee grace (days after last payment)">
            <Input
              inputMode="numeric"
              value={settings.paymentGraceDays ?? 35}
              onChange={(e) => patch({ paymentGraceDays: Number(e.target.value) || 0 })}
            />
          </Field>
        ) : null}
        <p className="text-[12px] text-muted-foreground sm:col-span-2">
          Anyone marked paused{kit.showSummer ? " or away for summer" : ""} gets a call reminder on the restart date.
          Renewals use each {kit.customer.toLowerCase()} start anniversary unless you set a date on their record.
          {kit.id === "tuition"
            ? " Returning students fire on their restart date. Missed fees fire if marked in arrears, or if last paid is older than the grace period."
            : ""}
        </p>
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
        <h3 className="font-medium sm:col-span-2">Income tax</h3>
        <Field label="Tax rate %">
          <Input
            inputMode="decimal"
            value={settings.taxRatePct}
            onChange={(e) => patch({ taxRatePct: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Cess / surcharge %">
          <Input
            inputMode="decimal"
            value={settings.cessPct}
            onChange={(e) => patch({ cessPct: Number(e.target.value) || 0 })}
          />
        </Field>
        <p className="text-[12px] text-muted-foreground sm:col-span-2">
          Leave at 0 if you file elsewhere. Indian proprietorships often use 30% + 4% cess — change this for a company, LLP, or another country.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-medium">Workbook data</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything lives in this browser. Use Export for Excel, a backup, or a link to this tool.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            onClick={() => {
              if (confirm(`Replace this workbook with example figures for ${kit.name}?`)) {
                replaceAll(
                  createKitLedger({
                    trade: kit.id,
                    sample: true,
                    name: settings.centreName,
                    owner: settings.instructorName,
                    city: settings.city,
                    currency: settings.currency,
                  }),
                );
              }
            }}
          >
            Load example for this kit
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("Clear the register, assets and figures? Settings are kept.")) {
                const blank = createKitLedger({
                  trade: kit.id,
                  sample: false,
                  name: settings.centreName,
                  owner: settings.instructorName,
                  city: settings.city,
                  currency: settings.currency,
                });
                replaceAll({
                  ...blank,
                  settings: { ...blank.settings, ...settings, onboarded: true, isSample: false },
                });
              }
            }}
          >
            Start a blank year
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (confirm("Start over and pick a different kit? Current figures will be cleared.")) {
                replaceAll(createUnboardedLedger());
              }
            }}
          >
            Pick a different kit
          </Button>
        </div>
      </section>
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
