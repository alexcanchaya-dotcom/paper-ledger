export const FY_MONTHS = [
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
  "Jan",
  "Feb",
  "Mar",
] as const;

export const CALENDAR_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export type FyMonth = (typeof FY_MONTHS)[number];
export type FyStartMonth = 0 | 3;

export function fyMonths(start: FyStartMonth = 3): string[] {
  return [...(start === 0 ? CALENDAR_MONTHS : FY_MONTHS)];
}

export type TradeId = "tuition" | "salon" | "studio" | "services" | "cafe" | "shop";

export type Subject = string;

export interface Offering {
  id: string;
  label: string;
}

export type StudentStatus = "active" | "paused" | "waiting" | "returning" | "left";

export const STATUS_LABEL: Record<StudentStatus, string> = {
  active: "Active",
  paused: "Paused",
  waiting: "Waiting",
  returning: "Returning",
  left: "Left",
};

export type AssetCategory =
  | "furniture"
  | "computers"
  | "equipment"
  | "signage"
  | "leasehold"
  | "other";

export type LicenseFeeMode = "percent" | "per_subject";
export type LicenseFeeBase = "gross" | "net";
export type CurrencyCode = "INR" | "USD" | "GBP" | "AUD" | "SGD" | "EUR";

export interface Settings {
  centreName: string;
  instructorName: string;
  city: string;
  fyStartYear: number;
  fyStartMonth: FyStartMonth;
  currency: CurrencyCode;
  licenseFeeMode: LicenseFeeMode;
  licenseFeeRate: number;
  licenseFeeBase: LicenseFeeBase;
  siblingDiscountPct: number;
  taxRatePct: number;
  cessPct: number;
  defaultMathFee: number;
  defaultEnglishFee: number;
  renewalNoticeDays: number;
  summerReturnDate: string;
  paymentGraceDays: number;
  tradeId: TradeId;
  onboarded: boolean;
  offerings: Offering[];
  isSample: boolean;
  lastBackupAt: string | null;
}

export interface Student {
  id: string;
  name: string;
  familyName: string;
  isPrimaryInFamily: boolean;
  subjects: string[];
  feePerSubject: number;
  feeBySubject: Record<string, number>;
  levelBySubject: Record<string, string>;
  daysPerWeek: number;
  status: StudentStatus;
  enrolledFrom: string;
  enrolledTo: string | null;
  restartOn: string | null;
  notes: string;
  tags: string[];
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  renewalOn: string | null;
  lastParentCall: string | null;
  lastPaidOn: string | null;
  arrears: boolean;
  awayForSummer: boolean;
  source: string;
  goalDate: string | null;
}

export const KUMON_LEVELS = [
  "6A",
  "5A",
  "4A",
  "3A",
  "2A",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
] as const;

export type ReminderKind = "renewal" | "summer_call" | "call" | "admin" | "payment";

export interface Task {
  id: string;
  title: string;
  dueOn: string;
  kind: ReminderKind;
  studentId: string | null;
  notes: string;
  done: boolean;
}

export interface ExtraRevenue {
  registration: number[];
  materials: number[];
  other: number[];
}

export type SystemExpenseKey =
  | "rent"
  | "wages"
  | "office_supplies"
  | "electricity"
  | "broadband"
  | "transport"
  | "marketing"
  | "miscellaneous";

export interface ExpenseRow {
  id: string;
  name: string;
  kind: "system" | "custom";
  systemKey?: SystemExpenseKey;
  values: number[];
}

export interface FixedAsset {
  id: string;
  name: string;
  category: AssetCategory;
  purchaseDate: string;
  cost: number;
  residualValue: number;
  usefulLifeYears: number;
  taxOpeningWdv: number;
  taxWdvRatePct: number;
  notes: string;
}

export interface TaxLine {
  id: string;
  name: string;
  amount: number;
}

export interface TaxAdjustments {
  disallowed: TaxLine[];
  deductions: TaxLine[];
  advanceTax: number;
  tds: number;
}

export interface LedgerState {
  settings: Settings;
  students: Student[];
  extraRevenue: ExtraRevenue;
  initialLicenseValues: number[];
  tuitionOverrides: (number | null)[];
  discountOverrides: (number | null)[];
  expenses: ExpenseRow[];
  assets: FixedAsset[];
  tax: TaxAdjustments;
  tasks: Task[];
  doneReminderKeys: string[];
}

export const TAX_WDV_RATES: Record<AssetCategory, number> = {
  furniture: 10,
  computers: 40,
  equipment: 15,
  signage: 15,
  leasehold: 10,
  other: 15,
};

export const ASSET_CATEGORY_LABEL: Record<AssetCategory, string> = {
  furniture: "Furniture & fittings",
  computers: "Computers & tablets",
  equipment: "Plant & equipment",
  signage: "Signage",
  leasehold: "Leasehold improvements",
  other: "Other",
};

export const CURRENCY_META: Record<CurrencyCode, { symbol: string; locale: string }> = {
  INR: { symbol: "₹", locale: "en-IN" },
  USD: { symbol: "$", locale: "en-US" },
  GBP: { symbol: "£", locale: "en-GB" },
  AUD: { symbol: "A$", locale: "en-AU" },
  SGD: { symbol: "S$", locale: "en-SG" },
  EUR: { symbol: "€", locale: "en-IE" },
};

export const TRADE_IDS: TradeId[] = ["tuition", "salon", "studio", "services", "cafe", "shop"];
