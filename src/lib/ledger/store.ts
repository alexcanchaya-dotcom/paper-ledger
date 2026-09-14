import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "@/lib/utils";
import { zeros, defaultFeeFor } from "./calc";
import { createUnboardedLedger } from "./defaults";
import { normalizeLedger } from "./normalize";
import {
  TAX_WDV_RATES,
  type AssetCategory,
  type ExpenseRow,
  type FixedAsset,
  type LedgerState,
  type Settings,
  type Student,
  type Task,
} from "./types";

type DataState = LedgerState;

interface LedgerStore extends DataState {
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  replaceAll: (state: LedgerState) => void;
  patchSettings: (patch: Partial<Settings>) => void;
  markBackupSaved: (at?: string) => void;
  addStudent: (student: Omit<Student, "id">) => void;
  updateStudent: (id: string, patch: Partial<Student>) => void;
  removeStudent: (id: string) => void;
  setExtraRevenue: (key: keyof LedgerState["extraRevenue"], month: number, value: number) => void;
  setInitialLicense: (month: number, value: number) => void;
  placeInitialLicense: (amount: number, month: number) => void;
  setTuitionOverride: (month: number, value: number | null) => void;
  setDiscountOverride: (month: number, value: number | null) => void;
  setExpenseValue: (id: string, month: number, value: number) => void;
  fillExpenseRow: (id: string, fromMonth: number) => void;
  addExpenseRow: (name: string) => void;
  renameExpenseRow: (id: string, name: string) => void;
  removeExpenseRow: (id: string) => void;
  addAsset: (asset: Omit<FixedAsset, "id">) => void;
  updateAsset: (id: string, patch: Partial<FixedAsset>) => void;
  removeAsset: (id: string) => void;
  addTaxLine: (kind: "disallowed" | "deductions") => void;
  updateTaxLine: (
    kind: "disallowed" | "deductions",
    id: string,
    patch: { name?: string; amount?: number },
  ) => void;
  removeTaxLine: (kind: "disallowed" | "deductions", id: string) => void;
  setTaxPaid: (patch: { advanceTax?: number; tds?: number }) => void;
  addTask: (task: Omit<Task, "id">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  markReminder: (key: string, done: boolean) => void;
}

const sample = createUnboardedLedger();

export const useLedger = create<LedgerStore>()(
  persist(
    (set) => ({
      ...sample,
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      replaceAll: (state) => set({ ...normalizeLedger(state) }),
      patchSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      markBackupSaved: (at) =>
        set((s) => ({
          settings: { ...s.settings, lastBackupAt: at ?? new Date().toISOString() },
        })),
      addStudent: (student) =>
        set((s) => ({ students: [...s.students, { ...student, id: uid("stu") }] })),
      updateStudent: (id, patch) =>
        set((s) => ({
          students: s.students.map((st) => (st.id === id ? { ...st, ...patch } : st)),
        })),
      removeStudent: (id) =>
        set((s) => ({ students: s.students.filter((st) => st.id !== id) })),
      setExtraRevenue: (key, month, value) =>
        set((s) => {
          const next = [...s.extraRevenue[key]];
          next[month] = value;
          return { extraRevenue: { ...s.extraRevenue, [key]: next } };
        }),
      setInitialLicense: (month, value) =>
        set((s) => {
          const next = [...(s.initialLicenseValues ?? zeros())];
          next[month] = value;
          return { initialLicenseValues: next };
        }),
      placeInitialLicense: (amount, month) =>
        set(() => {
          const next = zeros();
          const idx = Math.max(0, Math.min(11, month));
          next[idx] = amount;
          return { initialLicenseValues: next };
        }),
      setTuitionOverride: (month, value) =>
        set((s) => {
          const next = [...s.tuitionOverrides];
          next[month] = value;
          return { tuitionOverrides: next };
        }),
      setDiscountOverride: (month, value) =>
        set((s) => {
          const next = [...s.discountOverrides];
          next[month] = value;
          return { discountOverrides: next };
        }),
      setExpenseValue: (id, month, value) =>
        set((s) => ({
          expenses: s.expenses.map((row) => {
            if (row.id !== id) return row;
            const values = [...row.values];
            values[month] = value;
            return { ...row, values };
          }),
        })),
      fillExpenseRow: (id, fromMonth) =>
        set((s) => ({
          expenses: s.expenses.map((row) => {
            if (row.id !== id) return row;
            const values = [...row.values];
            const source = values[fromMonth] ?? 0;
            for (let i = fromMonth + 1; i < 12; i++) values[i] = source;
            return { ...row, values };
          }),
        })),
      addExpenseRow: (name) =>
        set((s) => {
          const row: ExpenseRow = {
            id: uid("exp"),
            name: name.trim() || "New cost line",
            kind: "custom",
            values: zeros(),
          };
          const miscIndex = s.expenses.findIndex((e) => e.systemKey === "miscellaneous");
          const expenses = [...s.expenses];
          expenses.splice(miscIndex >= 0 ? miscIndex + 1 : expenses.length, 0, row);
          return { expenses };
        }),
      renameExpenseRow: (id, name) =>
        set((s) => ({
          expenses: s.expenses.map((row) =>
            row.id === id && row.kind === "custom" ? { ...row, name } : row,
          ),
        })),
      removeExpenseRow: (id) =>
        set((s) => ({
          expenses: s.expenses.filter((row) => !(row.id === id && row.kind === "custom")),
        })),
      addAsset: (asset) => set((s) => ({ assets: [...s.assets, { ...asset, id: uid("fa") }] })),
      updateAsset: (id, patch) =>
        set((s) => ({
          assets: s.assets.map((a) => (a.id === id ? { ...a, ...patch } : a)),
        })),
      removeAsset: (id) => set((s) => ({ assets: s.assets.filter((a) => a.id !== id) })),
      addTaxLine: (kind) =>
        set((s) => ({
          tax: {
            ...s.tax,
            [kind]: [
              ...s.tax[kind],
              {
                id: uid("tax"),
                name: kind === "disallowed" ? "Add-back" : "Deduction",
                amount: 0,
              },
            ],
          },
        })),
      updateTaxLine: (kind, id, patch) =>
        set((s) => ({
          tax: {
            ...s.tax,
            [kind]: s.tax[kind].map((line) => (line.id === id ? { ...line, ...patch } : line)),
          },
        })),
      removeTaxLine: (kind, id) =>
        set((s) => ({
          tax: { ...s.tax, [kind]: s.tax[kind].filter((line) => line.id !== id) },
        })),
      setTaxPaid: (patch) => set((s) => ({ tax: { ...s.tax, ...patch } })),
      addTask: (task) => set((s) => ({ tasks: [...(s.tasks ?? []), { ...task, id: uid("task") }] })),
      updateTask: (id, patch) =>
        set((s) => ({ tasks: (s.tasks ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      toggleTask: (id) =>
        set((s) => ({ tasks: (s.tasks ?? []).map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })),
      removeTask: (id) => set((s) => ({ tasks: (s.tasks ?? []).filter((t) => t.id !== id) })),
      markReminder: (key, done) =>
        set((s) => {
          const setKeys = new Set(s.doneReminderKeys ?? []);
          if (done) setKeys.add(key);
          else setKeys.delete(key);
          return { doneReminderKeys: [...setKeys] };
        }),
    }),
    {
      name: "paper-ledger-v1",
      skipHydration: true,
      version: 4,
      migrate: (persisted) => normalizeLedger(persisted as Partial<LedgerState>),
      partialize: (state) => ({
        settings: state.settings,
        students: state.students,
        extraRevenue: state.extraRevenue,
        initialLicenseValues: state.initialLicenseValues,
        tuitionOverrides: state.tuitionOverrides,
        discountOverrides: state.discountOverrides,
        expenses: state.expenses,
        assets: state.assets,
        tax: state.tax,
        tasks: state.tasks,
        doneReminderKeys: state.doneReminderKeys,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

export function defaultAsset(category: AssetCategory = "furniture"): Omit<FixedAsset, "id"> {
  return {
    name: "",
    category,
    purchaseDate: new Date().toISOString().slice(0, 10),
    cost: 0,
    residualValue: 0,
    usefulLifeYears: category === "computers" ? 3 : 8,
    taxOpeningWdv: 0,
    taxWdvRatePct: TAX_WDV_RATES[category],
    notes: "",
  };
}

export function defaultStudent(): Omit<Student, "id"> {
  const settings = useLedger.getState().settings;
  const first = settings.offerings?.[0]?.id ?? "math";
  const fee = defaultFeeFor(settings, first);
  return {
    name: "",
    familyName: "",
    isPrimaryInFamily: true,
    subjects: [first],
    feePerSubject: fee,
    feeBySubject: { [first]: fee },
    levelBySubject: {},
    daysPerWeek: 2,
    status: "active",
    enrolledFrom: new Date().toISOString().slice(0, 10),
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
    source: "",
    goalDate: null,
  };
}
