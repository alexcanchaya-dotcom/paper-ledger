import { fyLabel, moneyPlain } from "./format";
import { computeTax, FY_MONTHS, monthPnL, yearPnL, assetPosition, taxDepreciationForAsset } from "./calc";
import { KIND_LABEL, buildDesk, relativeDue } from "./reminders";
import type { LedgerState } from "./types";

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\n");
}

export function buildWorkbookCsv(state: LedgerState): string {
  const { settings } = state;
  const y = yearPnL(state);
  const months = FY_MONTHS.map((_, i) => monthPnL(state, i));
  const tax = computeTax(state);
  const c = settings.currency;

  const header = ["Account", ...FY_MONTHS.map((m, i) => `${m} ${i < 9 ? settings.fyStartYear : settings.fyStartYear + 1}`), "YTD"];
  const line = (name: string, pick: (m: ReturnType<typeof monthPnL>) => number, ytd: number) => [
    name,
    ...months.map((m) => moneyPlain(pick(m), c, 2)),
    moneyPlain(ytd, c, 2),
  ];

  const pnl: (string | number)[][] = [
    [`${settings.centreName} — ${fyLabel(settings.fyStartYear)}`],
    header,
    line("Tuition (gross)", (m) => m.grossTuition, y.grossTuition),
    line("Sibling discounts", (m) => -m.siblingDiscount, -y.siblingDiscount),
    line("Registration fees", (m) => m.registration, y.registration),
    line("Materials / worksheets", (m) => m.materials, y.materials),
    line("Other income", (m) => m.otherIncome, y.otherIncome),
    line("Net revenue", (m) => m.netRevenue, y.netRevenue),
    [],
    line("Initial licence fee (one-off)", (m) => m.initialLicense, y.initialLicense),
    line(
      settings.licenseFeeMode === "percent"
        ? `Royalty (${settings.licenseFeeRate}% per subject)`
        : `Royalty (${settings.licenseFeeRate} per subject)`,
      (m) => m.licenseFee,
      y.licenseFee,
    ),
    ...state.expenses.map((row, idx) =>
      line(row.name, (m) => m.operatingExpenses[idx]?.amount ?? 0, y.operatingExpenses[idx]?.amount ?? 0),
    ),
    line("Amortisation", (m) => m.amortisation, y.amortisation),
    line("Total costs", (m) => m.totalCosts, y.totalCosts),
    [],
    line("Operating profit", (m) => m.operatingProfit, y.operatingProfit),
  ];

  const students: (string | number)[][] = [
    ["Students"],
    ["Name", "Family", "Primary", "Subjects", "Fee / subject", "Status", "From", "To", "Parent", "Phone", "Renewal", "Away summer"],
    ...state.students.map((s) => [
      s.name,
      s.familyName,
      s.isPrimaryInFamily ? "Yes" : "No",
      s.subjects.join("+"),
      s.feePerSubject,
      s.status,
      s.enrolledFrom,
      s.enrolledTo ?? "",
      s.parentName ?? "",
      s.parentPhone ?? "",
      s.renewalOn ?? "",
      s.awayForSummer ? "Yes" : "No",
    ]),
  ];

  const assets: (string | number)[][] = [
    ["Fixed asset register"],
    ["Asset", "Category", "Purchase", "Cost", "Residual", "Life (yrs)", "Books amort (FY)", "Accum. amort", "NBV", "Tax WDV rate", "Tax dep (FY)", "Closing WDV"],
    ...state.assets.map((a) => {
      const books = assetPosition(a, settings.fyStartYear);
      const taxA = taxDepreciationForAsset(a, settings.fyStartYear);
      return [
        a.name,
        a.category,
        a.purchaseDate,
        a.cost,
        a.residualValue,
        a.usefulLifeYears,
        books.yearCharge,
        books.closingAccum,
        books.nbv,
        a.taxWdvRatePct,
        taxA.depreciation,
        taxA.closingWdv,
      ];
    }),
  ];

  const taxSheet: (string | number)[][] = [
    ["Tax computation"],
    ["Profit before tax", tax.profitBeforeTax],
    ["Add: disallowed expenses", tax.disallowed],
    ["Add: amortisation per books", tax.bookAmortisation],
    ["Less: depreciation as per tax (WDV)", tax.taxDepreciation],
    ["Less: other deductions", tax.otherDeductions],
    ["Taxable income", tax.taxableIncome],
    [`Income tax @ ${settings.taxRatePct}%`, tax.incomeTax],
    [`Cess @ ${settings.cessPct}%`, tax.cess],
    ["Total tax", tax.totalTax],
    ["Less: advance tax", tax.advanceTax],
    ["Less: TDS", tax.tds],
    ["Tax payable / (refund)", tax.taxPayable],
  ];

  const desk: (string | number)[][] = [
    ["Centre desk"],
    ["Due", "Status", "Type", "Title", "Student", "Parent", "Phone", "Notes"],
    ...buildDesk(state).map((item) => [
      item.dueOn,
      item.done ? "Done" : relativeDue(item.dueOn),
      KIND_LABEL[item.kind],
      item.title,
      item.studentName ?? "",
      item.parentName ?? "",
      item.parentPhone ?? "",
      item.detail,
    ]),
  ];

  return [
    toCsv(pnl),
    "",
    toCsv(students),
    "",
    toCsv(desk),
    "",
    toCsv(assets),
    "",
    toCsv(taxSheet),
  ].join("\n");
}

export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
