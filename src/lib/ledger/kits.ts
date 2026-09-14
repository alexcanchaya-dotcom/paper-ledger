import { uid } from "@/lib/utils";
import { zeros } from "./calc";
import { TAX_WDV_RATES, type CurrencyCode, type ExtraRevenue, type LedgerState, type Student, type TradeId } from "./types";

export interface KitDef {
  id: TradeId;
  name: string;
  blurb: string;
  customer: string;
  customers: string;
  owner: string;
  offering: string;
  offeringsLabel: string;
  revenue: string;
  discount: string;
  royalty: string;
  group: string;
  contact: string;
  extra: { registration: string; materials: string; other: string };
  offerings: { id: string; label: string }[];
  defaultFee: number;
  licenseFeeRate: number;
  siblingDiscountPct: number;
  showSummer: boolean;
  fyStartMonth: 0 | 3;
  exampleName: string;
  exampleOwner: string;
  exampleCity: string;
}

export const KITS: Record<TradeId, KitDef> = {
  tuition: {
    id: "tuition",
    name: "Tuition & coaching",
    blurb: "The flagship kit: students, siblings, Math / English / other, Kumon levels, a franchise royalty, summer returns, and a desk that does not forget.",
    customer: "Student",
    customers: "Students",
    owner: "Instructor",
    offering: "Subject",
    offeringsLabel: "Subjects",
    revenue: "Tuition",
    discount: "Family discount",
    royalty: "Royalty",
    group: "Family",
    contact: "Parent / guardian",
    extra: { registration: "Registration fees", materials: "Materials / worksheets", other: "Other income" },
    offerings: [
      { id: "math", label: "Math" },
      { id: "english", label: "English" },
      { id: "other", label: "Other" },
    ],
    defaultFee: 95,
    licenseFeeRate: 33.75,
    siblingDiscountPct: 10,
    showSummer: true,
    fyStartMonth: 3,
    exampleName: "Riverside Centre",
    exampleOwner: "Ananya Sen",
    exampleCity: "Dublin",
  },
  salon: {
    id: "salon",
    name: "Salon & clinic",
    blurb: "Regulars on a monthly plan, plus retail and treatments on the P&L.",
    customer: "Client",
    customers: "Clients",
    owner: "Owner",
    offering: "Service",
    offeringsLabel: "Services",
    revenue: "Service fees",
    discount: "Family discount",
    royalty: "Royalty / platform fee",
    group: "Household",
    contact: "Phone contact",
    extra: { registration: "Retail products", materials: "Add-on treatments", other: "Other income" },
    offerings: [
      { id: "cut", label: "Cut" },
      { id: "colour", label: "Colour" },
      { id: "treat", label: "Treatment" },
    ],
    defaultFee: 85,
    licenseFeeRate: 0,
    siblingDiscountPct: 10,
    showSummer: false,
    fyStartMonth: 0,
    exampleName: "Iris Colour Bar",
    exampleOwner: "Priya Nair",
    exampleCity: "Dublin",
  },
  studio: {
    id: "studio",
    name: "Studio & classes",
    blurb: "Members paying monthly, drop-ins and merch on the side.",
    customer: "Member",
    customers: "Members",
    owner: "Owner",
    offering: "Class",
    offeringsLabel: "Classes",
    revenue: "Memberships",
    discount: "Family discount",
    royalty: "Platform fee",
    group: "Household",
    contact: "Contact",
    extra: { registration: "Drop-in classes", materials: "Merchandise", other: "Workshops" },
    offerings: [
      { id: "yoga", label: "Yoga" },
      { id: "pilates", label: "Pilates" },
    ],
    defaultFee: 95,
    licenseFeeRate: 0,
    siblingDiscountPct: 10,
    showSummer: true,
    fyStartMonth: 0,
    exampleName: "North Light Studio",
    exampleOwner: "Elena Costa",
    exampleCity: "Lisbon",
  },
  services: {
    id: "services",
    name: "Professional services",
    blurb: "Retainers, project fees, and a desk so follow-ups do not slip.",
    customer: "Client",
    customers: "Clients",
    owner: "Principal",
    offering: "Service",
    offeringsLabel: "Services",
    revenue: "Retainers",
    discount: "Intro discount",
    royalty: "Referral fee",
    group: "Company",
    contact: "Accounts contact",
    extra: { registration: "Project fees", materials: "Disbursements", other: "Other income" },
    offerings: [
      { id: "retain", label: "Retainer" },
      { id: "project", label: "Project" },
    ],
    defaultFee: 1200,
    licenseFeeRate: 0,
    siblingDiscountPct: 0,
    showSummer: false,
    fyStartMonth: 0,
    exampleName: "Harbour & Co",
    exampleOwner: "James Okonkwo",
    exampleCity: "Manchester",
  },
  cafe: {
    id: "cafe",
    name: "Cafe & bakery",
    blurb: "Daily sales on the P&L, with a short list of regulars if you run tabs.",
    customer: "Regular",
    customers: "Regulars",
    owner: "Owner",
    offering: "Tab",
    offeringsLabel: "Plans",
    revenue: "Tabs & plans",
    discount: "Loyalty discount",
    royalty: "Delivery commission",
    group: "Household",
    contact: "Contact",
    extra: { registration: "Food sales", materials: "Drink sales", other: "Catering" },
    offerings: [
      { id: "coffee", label: "Coffee club" },
      { id: "lunch", label: "Lunch tab" },
    ],
    defaultFee: 45,
    licenseFeeRate: 0,
    siblingDiscountPct: 0,
    showSummer: false,
    fyStartMonth: 0,
    exampleName: "Loaf & Co",
    exampleOwner: "Marta Silva",
    exampleCity: "Porto",
  },
  shop: {
    id: "shop",
    name: "Shop & retail",
    blurb: "Counter and online sales, plus a couple of wholesale accounts.",
    customer: "Account",
    customers: "Accounts",
    owner: "Owner",
    offering: "Channel",
    offeringsLabel: "Channels",
    revenue: "Account sales",
    discount: "Trade discount",
    royalty: "Marketplace fee",
    group: "Company",
    contact: "Buyer",
    extra: { registration: "Counter sales", materials: "Online sales", other: "Wholesale" },
    offerings: [
      { id: "counter", label: "Counter" },
      { id: "online", label: "Online" },
    ],
    defaultFee: 0,
    licenseFeeRate: 0,
    siblingDiscountPct: 5,
    showSummer: false,
    fyStartMonth: 0,
    exampleName: "Oak & Twine",
    exampleOwner: "Tomás Berg",
    exampleCity: "Stockholm",
  },
};

export const TRADE_LIST = Object.values(KITS);

export function kitOf(id?: string | null): KitDef {
  if (id && id in KITS) return KITS[id as TradeId];
  return KITS.tuition;
}

export function offeringLabel(settings: { offerings?: { id: string; label: string }[]; tradeId?: string }, id: string): string {
  return (
    settings.offerings?.find((o) => o.id === id)?.label ??
    kitOf(settings.tradeId).offerings.find((o) => o.id === id)?.label ??
    id
  );
}

function months(values: Partial<Record<number, number>> | number): number[] {
  if (typeof values === "number") return Array.from({ length: 12 }, () => values);
  const row = zeros();
  for (const [k, v] of Object.entries(values)) row[Number(k)] = v ?? 0;
  return row;
}

function person(partial: Partial<Student> & Pick<Student, "name" | "familyName" | "isPrimaryInFamily" | "subjects" | "feePerSubject" | "enrolledFrom">): Student {
  const feeBySubject: Record<string, number> = { ...(partial.feeBySubject ?? {}) };
  for (const id of partial.subjects) {
    if (typeof feeBySubject[id] !== "number") feeBySubject[id] = partial.feePerSubject;
  }
  return {
    id: uid("stu"),
    status: "active",
    enrolledTo: null,
    restartOn: null,
    notes: "",
    tags: [],
    parentName: "",
    parentPhone: "",
    parentEmail: "",
    renewalOn: null,
    lastParentCall: null,
    lastPaidOn: null,
    arrears: false,
    awayForSummer: false,
    levelBySubject: {},
    daysPerWeek: 2,
    source: "",
    goalDate: null,
    ...partial,
    feeBySubject: { ...feeBySubject, ...(partial.feeBySubject ?? {}) },
  };
}

function emptyExtra(): ExtraRevenue {
  return { registration: zeros(), materials: zeros(), other: zeros() };
}

function expense(name: string, key: LedgerState["expenses"][number]["systemKey"], values: number[] ): LedgerState["expenses"][number] {
  return { id: `exp_${key}`, name, kind: "system", systemKey: key, values };
}

function baseSettings(kit: KitDef, currency: CurrencyCode): LedgerState["settings"] {
  const inr = currency === "INR";
  return {
    centreName: kit.exampleName,
    instructorName: kit.exampleOwner,
    city: kit.exampleCity,
    fyStartYear: kit.fyStartMonth === 3 ? 2026 : 2026,
    fyStartMonth: kit.fyStartMonth,
    currency,
    licenseFeeMode: "percent",
    licenseFeeRate: kit.licenseFeeRate,
    licenseFeeBase: "gross",
    siblingDiscountPct: kit.siblingDiscountPct,
    taxRatePct: inr ? 30 : 0,
    cessPct: inr ? 4 : 0,
    defaultMathFee: kit.defaultFee,
    defaultEnglishFee: kit.defaultFee,
    renewalNoticeDays: 45,
    summerReturnDate: "2026-09-08",
    paymentGraceDays: 35,
    tradeId: kit.id,
    onboarded: true,
    offerings: kit.offerings,
    isSample: false,
    lastBackupAt: null,
  };
}

function emptyTax(): LedgerState["tax"] {
  return {
    disallowed: [{ id: uid("tax"), name: "Disallowed expense", amount: 0 }],
    deductions: [{ id: uid("tax"), name: "Other deduction", amount: 0 }],
    advanceTax: 0,
    tds: 0,
  };
}

function skeleton(kit: KitDef, currency: CurrencyCode): LedgerState {
  return {
    settings: baseSettings(kit, currency),
    students: [],
    extraRevenue: emptyExtra(),
    initialLicenseValues: zeros(),
    tuitionOverrides: Array.from({ length: 12 }, () => null),
    discountOverrides: Array.from({ length: 12 }, () => null),
    tasks: [],
    doneReminderKeys: [],
    expenses: [
      expense("Rent", "rent", zeros()),
      expense("Wages", "wages", zeros()),
      expense("Office supplies", "office_supplies", zeros()),
      expense("Electricity", "electricity", zeros()),
      expense("Broadband", "broadband", zeros()),
      expense("Transport", "transport", zeros()),
      expense("Marketing", "marketing", zeros()),
      expense("Miscellaneous", "miscellaneous", zeros()),
    ],
    assets: [],
    tax: emptyTax(),
  };
}

function tuitionSample(currency: CurrencyCode): LedgerState {
  const kit = KITS.tuition;
  const state = skeleton(kit, currency);
  const inr = currency === "INR";
  const math = inr ? 3500 : 95;
  const eng = inr ? 3300 : 90;
  const both = inr ? 3400 : 92;
  const phone = (n: string) => (inr ? `+91 ${n}` : `+353 ${n}`);
  if (inr) {
    state.settings.centreName = "Park Street Centre";
    state.settings.city = "Kolkata";
    state.settings.defaultMathFee = 3500;
    state.settings.defaultEnglishFee = 3300;
  }

  state.students = [
    person({
      name: "Aarav Mehta",
      familyName: "Mehta",
      isPrimaryInFamily: true,
      subjects: ["math", "english"],
      feePerSubject: both,
      feeBySubject: { math, english: eng },
      levelBySubject: { math: "C", english: "A" },
      daysPerWeek: 2,
      enrolledFrom: "2025-04-01",
      parentName: "Neha Mehta",
      parentPhone: phone("98 2100 4411"),
      parentEmail: "neha.mehta@example.com",
      source: "Walk-in",
      goalDate: "2028-04-01",
    }),
    person({
      name: "Diya Mehta",
      familyName: "Mehta",
      isPrimaryInFamily: false,
      subjects: ["math"],
      feePerSubject: math,
      feeBySubject: { math },
      levelBySubject: { math: "B" },
      daysPerWeek: 2,
      enrolledFrom: "2025-06-01",
      parentName: "Neha Mehta",
      parentPhone: phone("98 2100 4411"),
      parentEmail: "neha.mehta@example.com",
      source: "Sibling",
    }),
    person({
      name: "Ishaan Rao",
      familyName: "Rao",
      isPrimaryInFamily: true,
      subjects: ["math"],
      feePerSubject: math,
      levelBySubject: { math: "D" },
      daysPerWeek: 3,
      enrolledFrom: "2024-11-01",
      parentName: "Sanjay Rao",
      parentPhone: phone("87 441 0900"),
      parentEmail: "sanjay.rao@example.com",
      source: "School",
      goalDate: "2027-11-01",
    }),
    person({
      name: "Kabir Shah",
      familyName: "Shah",
      isPrimaryInFamily: true,
      subjects: ["math", "english"],
      feePerSubject: both,
      feeBySubject: { math, english: eng },
      levelBySubject: { math: "E", english: "C" },
      daysPerWeek: 2,
      enrolledFrom: "2025-01-15",
      parentName: "Priya Shah",
      parentPhone: phone("87 212 3344"),
      parentEmail: "priya.shah@example.com",
      source: "Referral",
    }),
    person({
      name: "Myra Shah",
      familyName: "Shah",
      isPrimaryInFamily: false,
      subjects: ["english"],
      feePerSubject: eng,
      feeBySubject: { english: eng },
      levelBySubject: { english: "B" },
      enrolledFrom: "2025-01-15",
      parentName: "Priya Shah",
      parentPhone: phone("87 212 3344"),
      parentEmail: "priya.shah@example.com",
      source: "Sibling",
    }),
    person({
      name: "Sara Banerjee",
      familyName: "Banerjee",
      isPrimaryInFamily: true,
      subjects: ["english"],
      feePerSubject: eng,
      levelBySubject: { english: "A" },
      enrolledFrom: "2025-07-01",
      status: "paused",
      awayForSummer: true,
      restartOn: "2026-09-08",
      tags: ["summer"],
      parentName: "Rina Banerjee",
      parentPhone: phone("87 100 2001"),
      parentEmail: "rina.banerjee@example.com",
      source: "Walk-in",
    }),
    person({
      name: "Advait Iyer",
      familyName: "Iyer",
      isPrimaryInFamily: true,
      subjects: ["math"],
      feePerSubject: math,
      levelBySubject: { math: "F" },
      daysPerWeek: 2,
      enrolledFrom: "2025-09-01",
      parentName: "Lakshmi Iyer",
      parentPhone: phone("86 300 7721"),
      parentEmail: "lakshmi.iyer@example.com",
      source: "Website",
    }),
    person({
      name: "Vihaan Nair",
      familyName: "Nair",
      isPrimaryInFamily: true,
      subjects: ["english"],
      feePerSubject: eng,
      levelBySubject: { english: "C" },
      enrolledFrom: "2025-04-01",
      status: "returning",
      restartOn: "2026-09-15",
      awayForSummer: true,
      tags: ["returning"],
      parentName: "Meera Nair",
      parentPhone: phone("86 555 0144"),
      source: "School",
    }),
    person({
      name: "Neil Gupta",
      familyName: "Gupta",
      isPrimaryInFamily: true,
      subjects: ["math"],
      feePerSubject: math,
      levelBySubject: { math: "C" },
      enrolledFrom: "2025-10-01",
      lastPaidOn: "2026-07-12",
      arrears: true,
      tags: ["arrears"],
      parentName: "Amit Gupta",
      parentPhone: phone("87 440 1188"),
      parentEmail: "amit.gupta@example.com",
      source: "Walk-in",
    }),
    person({
      name: "Aisha Rahman",
      familyName: "Rahman",
      isPrimaryInFamily: true,
      subjects: ["english"],
      feePerSubject: eng,
      levelBySubject: { english: "D" },
      enrolledFrom: "2025-12-01",
      awayForSummer: true,
      restartOn: "2026-09-08",
      tags: ["summer"],
      parentName: "Nadia Rahman",
      parentPhone: phone("85 221 0909"),
      parentEmail: "nadia.rahman@example.com",
      source: "Referral",
    }),
    person({
      name: "Arjun Reddy",
      familyName: "Reddy",
      isPrimaryInFamily: true,
      subjects: ["math"],
      feePerSubject: math,
      levelBySubject: { math: "2A" },
      daysPerWeek: 2,
      enrolledFrom: "2026-04-01",
      parentName: "Kavya Reddy",
      parentPhone: phone("86 118 4400"),
      parentEmail: "kavya.reddy@example.com",
      source: "Website",
    }),
    person({
      name: "Mira Reddy",
      familyName: "Reddy",
      isPrimaryInFamily: false,
      subjects: ["english"],
      feePerSubject: eng,
      levelBySubject: { english: "3A" },
      enrolledFrom: "2026-04-01",
      parentName: "Kavya Reddy",
      parentPhone: phone("86 118 4400"),
      parentEmail: "kavya.reddy@example.com",
      source: "Sibling",
    }),
    person({
      name: "Dev Patel",
      familyName: "Patel",
      isPrimaryInFamily: true,
      subjects: ["math", "other"],
      feePerSubject: math,
      feeBySubject: { math, other: inr ? 1800 : 45 },
      levelBySubject: { math: "B", other: "4A" },
      enrolledFrom: "2026-07-01",
      parentName: "Anita Patel",
      parentPhone: phone("85 770 2211"),
      source: "Walk-in",
      tags: ["handwriting"],
      notes: "Other subject is handwriting support.",
    }),
    person({
      name: "Rohan Joshi",
      familyName: "Joshi",
      isPrimaryInFamily: true,
      subjects: ["math", "english"],
      feePerSubject: both,
      feeBySubject: { math, english: eng },
      levelBySubject: { math: "G", english: "E" },
      daysPerWeek: 3,
      enrolledFrom: "2025-04-01",
      parentName: "Vikram Joshi",
      parentPhone: phone("87 900 1100"),
      parentEmail: "vikram.joshi@example.com",
      source: "School",
      goalDate: "2027-04-01",
      tags: ["exam year"],
      lastPaidOn: "2026-09-01",
    }),
    person({
      name: "Leela Kapoor",
      familyName: "Kapoor",
      isPrimaryInFamily: true,
      subjects: ["math"],
      feePerSubject: math,
      levelBySubject: { math: "6A" },
      enrolledFrom: "2026-10-01",
      status: "waiting",
      parentName: "Sonia Kapoor",
      parentPhone: phone("86 333 0909"),
      parentEmail: "sonia.kapoor@example.com",
      source: "Website",
      notes: "Assessment done. Start first week of October.",
    }),
    person({
      name: "Samir Dutt",
      familyName: "Dutt",
      isPrimaryInFamily: true,
      subjects: ["english"],
      feePerSubject: eng,
      levelBySubject: { english: "5A" },
      enrolledFrom: "2026-09-21",
      status: "waiting",
      parentName: "Arun Dutt",
      parentPhone: phone("87 221 7788"),
      parentEmail: "arun.dutt@example.com",
      source: "Referral",
      notes: "Sibling of a former student. Desk should catch the start date.",
    }),
  ];

  if (inr) {
    state.extraRevenue = {
      registration: months({ 0: 8000, 1: 4000, 2: 2000, 3: 6000, 4: 2000, 5: 4000 }),
      materials: months({ 0: 3600, 3: 2400, 6: 3600 }),
      other: months({ 1: 1500 }),
    };
    state.expenses = [
      expense("Rent", "rent", months(22000)),
      expense("Wages", "wages", months(18000)),
      expense("Office supplies", "office_supplies", months({ 0: 2800, 1: 1200, 2: 1600, 3: 2100, 4: 900, 5: 1500 })),
      expense("Electricity", "electricity", months({ 0: 4200, 1: 4800, 2: 5100, 3: 4700, 4: 3900, 5: 3600 })),
      expense("Broadband", "broadband", months(1499)),
      expense("Transport fee", "transport", months({ 0: 2400, 1: 1800, 2: 2200, 3: 2600, 4: 2000, 5: 2100 })),
      expense("Marketing", "marketing", months({ 0: 8000, 1: 2500, 3: 4500, 5: 3000 })),
      expense("Miscellaneous", "miscellaneous", months({ 0: 1800, 2: 900, 4: 1200, 5: 600 })),
    ];
    state.assets = [
      { id: uid("fa"), name: "Classroom furniture", category: "furniture", purchaseDate: "2025-04-01", cost: 120000, residualValue: 6000, usefulLifeYears: 10, taxOpeningWdv: 108000, taxWdvRatePct: TAX_WDV_RATES.furniture, notes: "" },
      { id: uid("fa"), name: "Computers & tablets", category: "computers", purchaseDate: "2025-06-15", cost: 64000, residualValue: 4000, usefulLifeYears: 3, taxOpeningWdv: 38400, taxWdvRatePct: TAX_WDV_RATES.computers, notes: "" },
      { id: uid("fa"), name: "Split AC", category: "equipment", purchaseDate: "2025-05-01", cost: 42000, residualValue: 2000, usefulLifeYears: 8, taxOpeningWdv: 35700, taxWdvRatePct: TAX_WDV_RATES.equipment, notes: "" },
    ];
    state.tax.advanceTax = 18000;
  } else {
    state.extraRevenue = {
      registration: months({ 0: 190, 1: 95, 2: 45, 3: 140, 4: 45, 5: 95 }),
      materials: months({ 0: 80, 3: 60, 6: 80 }),
      other: months({ 1: 40 }),
    };
    state.expenses = [
      expense("Rent", "rent", months(1850)),
      expense("Wages", "wages", months(2100)),
      expense("Office supplies", "office_supplies", months({ 0: 85, 1: 40, 2: 55, 3: 70, 4: 30, 5: 48 })),
      expense("Electricity", "electricity", months({ 0: 140, 1: 155, 2: 168, 3: 150, 4: 120, 5: 110 })),
      expense("Broadband", "broadband", months(45)),
      expense("Transport fee", "transport", months({ 0: 90, 1: 70, 2: 85, 3: 95, 4: 75, 5: 80 })),
      expense("Marketing", "marketing", months({ 0: 220, 1: 80, 3: 140, 5: 90 })),
      expense("Miscellaneous", "miscellaneous", months({ 0: 55, 2: 30, 4: 40, 5: 20 })),
    ];
    state.assets = [
      { id: uid("fa"), name: "Classroom furniture", category: "furniture", purchaseDate: "2025-04-01", cost: 4200, residualValue: 200, usefulLifeYears: 10, taxOpeningWdv: 3780, taxWdvRatePct: TAX_WDV_RATES.furniture, notes: "" },
      { id: uid("fa"), name: "Computers & tablets", category: "computers", purchaseDate: "2025-06-15", cost: 2800, residualValue: 150, usefulLifeYears: 3, taxOpeningWdv: 1680, taxWdvRatePct: TAX_WDV_RATES.computers, notes: "" },
      { id: uid("fa"), name: "Split AC", category: "equipment", purchaseDate: "2025-05-01", cost: 1600, residualValue: 80, usefulLifeYears: 8, taxOpeningWdv: 1360, taxWdvRatePct: TAX_WDV_RATES.equipment, notes: "" },
    ];
    state.tax.advanceTax = 0;
  }

  state.tasks = [
    { id: uid("task"), title: "Call Kabir Shah's mum about adding a third day", dueOn: "2026-09-14", kind: "call", studentId: null, notes: "She asked at drop-off last week", done: false },
    { id: uid("task"), title: "Confirm September worksheet order", dueOn: "2026-09-16", kind: "admin", studentId: null, notes: "", done: false },
    { id: uid("task"), title: "Place Leela Kapoor after assessment", dueOn: "2026-09-22", kind: "admin", studentId: null, notes: "Waiting list — math 6A", done: false },
  ];
  return state;
}

function salonSample(currency: CurrencyCode): LedgerState {
  const state = skeleton(KITS.salon, currency);
  state.students = [
    person({ name: "Aoife Byrne", familyName: "Byrne", isPrimaryInFamily: true, subjects: ["cut", "colour"], feePerSubject: 75, enrolledFrom: "2025-03-01", parentName: "Aoife Byrne", parentPhone: "+353 86 200 1100" }),
    person({ name: "Niamh Byrne", familyName: "Byrne", isPrimaryInFamily: false, subjects: ["cut"], feePerSubject: 55, enrolledFrom: "2025-09-01" }),
    person({ name: "Sofia Almeida", familyName: "Almeida", isPrimaryInFamily: true, subjects: ["colour", "treat"], feePerSubject: 90, enrolledFrom: "2024-11-12", parentPhone: "+353 87 441 0900" }),
    person({ name: "Rachel Keane", familyName: "Keane", isPrimaryInFamily: true, subjects: ["cut"], feePerSubject: 55, enrolledFrom: "2026-01-08" }),
    person({ name: "Mei Chen", familyName: "Chen", isPrimaryInFamily: true, subjects: ["cut", "treat"], feePerSubject: 70, enrolledFrom: "2025-10-01", parentPhone: "+353 85 300 2211" }),
    person({ name: "Laura Walsh", familyName: "Walsh", isPrimaryInFamily: true, subjects: ["colour"], feePerSubject: 95, enrolledFrom: "2025-06-01", status: "paused" }),
  ];
  state.extraRevenue = {
    registration: months({ 0: 1800, 1: 2100, 2: 1600, 3: 2400, 4: 1900, 5: 2200 }),
    materials: months({ 0: 640, 1: 420, 2: 380, 3: 510, 4: 290, 5: 440 }),
    other: months({ 2: 200 }),
  };
  state.expenses = [
    expense("Rent", "rent", months(2800)),
    expense("Wages", "wages", months(4200)),
    expense("Colour & product", "office_supplies", months({ 0: 680, 1: 540, 2: 610, 3: 720, 4: 490, 5: 580 })),
    expense("Electricity", "electricity", months(220)),
    expense("Broadband", "broadband", months(49)),
    expense("Laundry / towels", "transport", months(90)),
    expense("Marketing", "marketing", months({ 0: 250, 3: 180, 5: 120 })),
    expense("Miscellaneous", "miscellaneous", months({ 1: 60, 4: 40 })),
  ];
  state.assets = [
    { id: uid("fa"), name: "Styling chairs", category: "furniture", purchaseDate: "2024-09-01", cost: 4800, residualValue: 400, usefulLifeYears: 8, taxOpeningWdv: 3600, taxWdvRatePct: TAX_WDV_RATES.furniture, notes: "" },
    { id: uid("fa"), name: "Steamer & dryer bank", category: "equipment", purchaseDate: "2025-02-01", cost: 2200, residualValue: 100, usefulLifeYears: 5, taxOpeningWdv: 1870, taxWdvRatePct: TAX_WDV_RATES.equipment, notes: "" },
  ];
  state.tasks = [
    { id: uid("task"), title: "Reorder Wella 6/0 and 7/3", dueOn: "2026-09-16", kind: "admin", studentId: null, notes: "Two weeks of stock left", done: false },
    { id: uid("task"), title: "Call Laura Walsh — colour restart", dueOn: "2026-09-15", kind: "call", studentId: null, notes: "Paused in June", done: false },
  ];
  return state;
}

function studioSample(currency: CurrencyCode): LedgerState {
  const state = skeleton(KITS.studio, currency);
  state.students = [
    person({ name: "Clara Mendes", familyName: "Mendes", isPrimaryInFamily: true, subjects: ["yoga"], feePerSubject: 95, enrolledFrom: "2025-01-10" }),
    person({ name: "Rui Mendes", familyName: "Mendes", isPrimaryInFamily: false, subjects: ["pilates"], feePerSubject: 95, enrolledFrom: "2025-04-01" }),
    person({ name: "Hannah Cole", familyName: "Cole", isPrimaryInFamily: true, subjects: ["yoga", "pilates"], feePerSubject: 80, enrolledFrom: "2024-09-01" }),
    person({ name: "Omar Haddad", familyName: "Haddad", isPrimaryInFamily: true, subjects: ["yoga"], feePerSubject: 95, enrolledFrom: "2025-09-01", parentPhone: "+351 91 200 3344" }),
    person({ name: "Ines Rocha", familyName: "Rocha", isPrimaryInFamily: true, subjects: ["pilates"], feePerSubject: 95, enrolledFrom: "2026-05-01", awayForSummer: true }),
  ];
  state.extraRevenue = {
    registration: months({ 0: 420, 1: 360, 2: 280, 3: 510, 4: 190, 5: 240 }),
    materials: months({ 0: 180, 3: 90 }),
    other: months({ 2: 600 }),
  };
  state.expenses = [
    expense("Rent", "rent", months(1600)),
    expense("Instructors", "wages", months(2200)),
    expense("Mats & props", "office_supplies", months({ 0: 140, 4: 80 })),
    expense("Electricity", "electricity", months(110)),
    expense("Broadband", "broadband", months(35)),
    expense("Cleaning", "transport", months(80)),
    expense("Marketing", "marketing", months({ 0: 200, 3: 150 })),
    expense("Miscellaneous", "miscellaneous", months({ 1: 40 })),
  ];
  state.tasks = [
    { id: uid("task"), title: "Print September timetable", dueOn: "2026-09-15", kind: "admin", studentId: null, notes: "", done: false },
    { id: uid("task"), title: "Call Ines about autumn return", dueOn: "2026-09-08", kind: "summer_call", studentId: null, notes: "", done: false },
  ];
  return state;
}

function servicesSample(currency: CurrencyCode): LedgerState {
  const state = skeleton(KITS.services, currency);
  state.students = [
    person({ name: "Northwind Bakery", familyName: "Northwind", isPrimaryInFamily: true, subjects: ["retain"], feePerSubject: 850, enrolledFrom: "2025-04-01", parentName: "Sara Khan", parentPhone: "+44 7700 900111" }),
    person({ name: "Pebble Digital", familyName: "Pebble", isPrimaryInFamily: true, subjects: ["retain", "project"], feePerSubject: 1400, enrolledFrom: "2025-10-01", parentName: "Chris Adeyemi" }),
    person({ name: "Dr. Helen Park", familyName: "Park Practice", isPrimaryInFamily: true, subjects: ["retain"], feePerSubject: 600, enrolledFrom: "2024-06-01" }),
    person({ name: "Quay Coffee", familyName: "Quay", isPrimaryInFamily: true, subjects: ["project"], feePerSubject: 2200, enrolledFrom: "2026-07-01" }),
  ];
  state.extraRevenue = {
    registration: months({ 0: 2400, 2: 1800, 4: 3200, 5: 900 }),
    materials: months({ 1: 220, 3: 180 }),
    other: months({}),
  };
  state.expenses = [
    expense("Studio rent", "rent", months(950)),
    expense("Contractor wages", "wages", months(1800)),
    expense("Software & tools", "office_supplies", months(140)),
    expense("Electricity", "electricity", months(70)),
    expense("Broadband", "broadband", months(42)),
    expense("Travel", "transport", months({ 0: 80, 2: 160, 4: 90 })),
    expense("Marketing", "marketing", months({ 1: 200 })),
    expense("Miscellaneous", "miscellaneous", months({ 3: 50 })),
  ];
  state.tasks = [
    { id: uid("task"), title: "Send Pebble August pack", dueOn: "2026-09-15", kind: "admin", studentId: null, notes: "", done: false },
    { id: uid("task"), title: "Renewal chat — Dr Park", dueOn: "2026-09-20", kind: "renewal", studentId: null, notes: "On the books since 2024", done: false },
  ];
  return state;
}

function cafeSample(currency: CurrencyCode): LedgerState {
  const state = skeleton(KITS.cafe, currency);
  state.students = [
    person({ name: "Office 12 tab", familyName: "Office 12", isPrimaryInFamily: true, subjects: ["lunch"], feePerSubject: 280, enrolledFrom: "2026-04-01", parentName: "Facilities" }),
    person({ name: "João coffee club", familyName: "Costa", isPrimaryInFamily: true, subjects: ["coffee"], feePerSubject: 32, enrolledFrom: "2025-09-01" }),
  ];
  state.extraRevenue = {
    registration: months({ 0: 9200, 1: 8800, 2: 10100, 3: 11400, 4: 9800, 5: 10900 }),
    materials: months({ 0: 4100, 1: 3900, 2: 4400, 3: 4800, 4: 4200, 5: 4600 }),
    other: months({ 1: 600, 4: 1200 }),
  };
  state.expenses = [
    expense("Rent", "rent", months(2100)),
    expense("Wages", "wages", months(4800)),
    expense("Ingredients", "office_supplies", months({ 0: 3100, 1: 2900, 2: 3300, 3: 3600, 4: 3000, 5: 3400 })),
    expense("Electricity", "electricity", months(280)),
    expense("Broadband", "broadband", months(39)),
    expense("Delivery / packaging", "transport", months(180)),
    expense("Marketing", "marketing", months({ 0: 150, 3: 90 })),
    expense("Miscellaneous", "miscellaneous", months({ 2: 70 })),
  ];
  state.assets = [
    { id: uid("fa"), name: "Espresso machine", category: "equipment", purchaseDate: "2024-11-01", cost: 6400, residualValue: 400, usefulLifeYears: 7, taxOpeningWdv: 4800, taxWdvRatePct: TAX_WDV_RATES.equipment, notes: "" },
    { id: uid("fa"), name: "Tables & benches", category: "furniture", purchaseDate: "2024-11-01", cost: 2800, residualValue: 200, usefulLifeYears: 8, taxOpeningWdv: 2200, taxWdvRatePct: TAX_WDV_RATES.furniture, notes: "" },
  ];
  state.tasks = [
    { id: uid("task"), title: "Order beans — two sacks of the house blend", dueOn: "2026-09-16", kind: "admin", studentId: null, notes: "", done: false },
    { id: uid("task"), title: "Confirm Saturday catering for Office 12", dueOn: "2026-09-18", kind: "call", studentId: null, notes: "", done: false },
  ];
  return state;
}

function shopSample(currency: CurrencyCode): LedgerState {
  const state = skeleton(KITS.shop, currency);
  state.students = [
    person({ name: "Hotel Clara", familyName: "Hotel Clara", isPrimaryInFamily: true, subjects: ["counter"], feePerSubject: 420, enrolledFrom: "2025-02-01", parentName: "Procurement" }),
    person({ name: "Atelier June", familyName: "Atelier June", isPrimaryInFamily: true, subjects: ["online"], feePerSubject: 180, enrolledFrom: "2026-01-15" }),
  ];
  state.extraRevenue = {
    registration: months({ 0: 6400, 1: 5800, 2: 7200, 3: 8100, 4: 6900, 5: 7600 }),
    materials: months({ 0: 2100, 1: 1800, 2: 2400, 3: 2600, 4: 1900, 5: 2300 }),
    other: months({ 0: 900, 3: 1400 }),
  };
  state.expenses = [
    expense("Rent", "rent", months(1900)),
    expense("Wages", "wages", months(2400)),
    expense("Stock purchases", "office_supplies", months({ 0: 2800, 1: 2200, 2: 3100, 3: 3400, 4: 2500, 5: 2900 })),
    expense("Electricity", "electricity", months(160)),
    expense("Broadband", "broadband", months(38)),
    expense("Shipping", "transport", months({ 0: 220, 1: 180, 2: 260, 3: 240, 4: 190, 5: 210 })),
    expense("Marketing", "marketing", months({ 0: 180, 3: 120 })),
    expense("Miscellaneous", "miscellaneous", months({ 2: 40 })),
  ];
  state.tasks = [
    { id: uid("task"), title: "Restock oak frames before weekend", dueOn: "2026-09-17", kind: "admin", studentId: null, notes: "", done: false },
  ];
  return state;
}

const SAMPLES: Record<TradeId, (c: CurrencyCode) => LedgerState> = {
  tuition: tuitionSample,
  salon: salonSample,
  studio: studioSample,
  services: servicesSample,
  cafe: cafeSample,
  shop: shopSample,
};

export function createKitLedger(opts: {
  trade: TradeId;
  sample: boolean;
  name?: string;
  owner?: string;
  city?: string;
  currency?: CurrencyCode;
}): LedgerState {
  const kit = kitOf(opts.trade);
  const currency = opts.currency ?? "EUR";
  const state = opts.sample ? SAMPLES[kit.id](currency) : skeleton(kit, currency);
  state.settings.centreName = opts.name?.trim() || kit.exampleName;
  state.settings.instructorName = opts.owner?.trim() || (opts.sample ? kit.exampleOwner : "");
  state.settings.city = opts.city?.trim() || (opts.sample ? kit.exampleCity : "");
  state.settings.currency = currency;
  state.settings.tradeId = kit.id;
  state.settings.onboarded = true;
  state.settings.offerings = kit.offerings;
  state.settings.licenseFeeRate = kit.licenseFeeRate;
  state.settings.siblingDiscountPct = kit.siblingDiscountPct;
  state.settings.defaultMathFee = kit.defaultFee;
  state.settings.defaultEnglishFee = kit.defaultFee;
  state.settings.fyStartMonth = kit.fyStartMonth;
  state.settings.isSample = opts.sample;
  if (kit.id === "tuition" && currency === "INR") {
    state.settings.defaultMathFee = 3500;
    state.settings.defaultEnglishFee = 3300;
    if (!opts.name?.trim()) state.settings.centreName = "Park Street Centre";
    if (!opts.city?.trim() && opts.sample) state.settings.city = "Kolkata";
  }
  return state;
}

export function createUnboardedLedger(): LedgerState {
  const state = skeleton(KITS.tuition, "EUR");
  state.settings.onboarded = false;
  state.settings.centreName = "";
  state.settings.instructorName = "";
  state.settings.city = "";
  return state;
}
