import { CURRENCY_META, fyMonths, type CurrencyCode, type FyStartMonth } from "./types";

export function money(value: number, currency: CurrencyCode, digits = 0): string {
  const { locale } = CURRENCY_META[currency];
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(abs);
  const sign = value < 0 ? "−" : "";
  return `${sign}${CURRENCY_META[currency].symbol}${formatted}`;
}

export function moneyPlain(value: number, currency: CurrencyCode, digits = 0): string {
  const { locale } = CURRENCY_META[currency];
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function pct(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[,₹$£€A\s]/g, "").replace(/−/g, "-");
  if (cleaned === "" || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function fyYearOf(fyStartYear: number, fyStartMonth: number, monthIndex: number): number {
  return fyStartYear + Math.floor((fyStartMonth + monthIndex) / 12);
}

export function monthLabel(
  monthIndex: number,
  fyStartYear: number,
  fyStartMonth: FyStartMonth = 3,
): string {
  const names = fyMonths(fyStartMonth);
  return `${names[monthIndex]} ${String(fyYearOf(fyStartYear, fyStartMonth, monthIndex)).slice(-2)}`;
}

export function fyLabel(fyStartYear: number, fyStartMonth: FyStartMonth = 3): string {
  if (fyStartMonth === 0) return `FY ${fyStartYear}`;
  return `FY ${fyStartYear}–${String(fyStartYear + 1).slice(-2)}`;
}

export function fyYearLabels(fyStartYear: number, fyStartMonth: FyStartMonth = 3): string[] {
  return Array.from({ length: 12 }, (_, i) => String(fyYearOf(fyStartYear, fyStartMonth, i)));
}
