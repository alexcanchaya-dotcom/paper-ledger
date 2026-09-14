import { normalizeLedger } from "./normalize";
import { fyLabel } from "./format";
import { kitOf } from "./kits";
import type { LedgerState } from "./types";

export const BACKUP_APP = "paper-ledger";
export const BACKUP_VERSION = 2;

export const HOW_TO_RESTORE =
  "This is a Paper Ledger backup of the live books. Open Paper Ledger → Export → Restore, or on the first screen tap Open a backup. The Excel .xlsx file is for the accountant and cannot be restored here.";

export interface LedgerBackup {
  app: string;
  version: number;
  exportedAt: string;
  howToRestore: string;
  preview: BackupPreview;
  ledger: LedgerState;
}

export interface BackupPreview {
  centreName: string;
  kitName: string;
  tradeId: string;
  fy: string;
  studentCount: number;
  expenseRows: number;
  assetCount: number;
  exportedAt: string | null;
  lastBackupAt: string | null;
}

export function snapshotLedger(state: LedgerState): LedgerState {
  return normalizeLedger(state);
}

export function buildBackup(state: LedgerState): LedgerBackup {
  const ledger = snapshotLedger(state);
  const exportedAt = new Date().toISOString();
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt,
    howToRestore: HOW_TO_RESTORE,
    preview: previewFromLedger(ledger, exportedAt),
    ledger,
  };
}

export function backupFilename(state: LedgerState): string {
  const name = safeFilename(state.settings.centreName || "paper-ledger");
  return `${name}-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export function safeFilename(raw: string): string {
  return (
    raw
      .replace(/[–—]/g, "-")
      .replace(/[\\/:*?"<>|]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "paper-ledger"
  );
}

export function fileKindError(file: File): string | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return "That is the Excel workbook for your accountant. Paper Ledger cannot open it back in. Use the .json file from Save backup.";
  }
  if (name.endsWith(".csv")) {
    return "That is a spreadsheet, not a Paper Ledger backup. Use the .json file from Save backup.";
  }
  return null;
}

export function parseBackup(raw: string): LedgerState {
  const { ledger } = inspectBackup(raw);
  return { ...ledger, settings: { ...ledger.settings, onboarded: true, isSample: false } };
}

export function inspectBackup(raw: string): {
  ledger: LedgerState;
  preview: BackupPreview;
  exportedAt: string | null;
} {
  const trimmed = raw.replace(/^\uFEFF/, "").trim();
  if (!trimmed) throw new Error("That file is empty.");
  if (trimmed.startsWith("PK")) {
    throw new Error(
      "That looks like an Excel workbook. Paper Ledger cannot restore .xlsx files. Use the .json backup.",
    );
  }
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new Error("That file is not a Paper Ledger backup. Save backup makes a .json file.");
  }
  if (!data || typeof data !== "object") throw new Error("That file is empty.");
  const obj = data as Record<string, unknown>;
  if (obj.app && obj.app !== BACKUP_APP) {
    throw new Error("This file is not a Paper Ledger backup.");
  }
  const ledgerRaw = (obj.ledger ?? obj) as Partial<LedgerState>;
  if (!ledgerRaw.settings || typeof ledgerRaw.settings !== "object") {
    throw new Error("That backup is missing settings.");
  }
  if (!Array.isArray(ledgerRaw.students) || !Array.isArray(ledgerRaw.expenses)) {
    throw new Error("That backup is missing the books.");
  }
  const ledger = normalizeLedger(ledgerRaw);
  const exportedAt = typeof obj.exportedAt === "string" ? obj.exportedAt : null;
  return {
    ledger,
    exportedAt,
    preview: previewFromLedger(ledger, exportedAt),
  };
}

export async function inspectBackupFile(file: File): Promise<{
  ledger: LedgerState;
  preview: BackupPreview;
  exportedAt: string | null;
}> {
  const kind = fileKindError(file);
  if (kind) throw new Error(kind);
  const raw = await file.text();
  return inspectBackup(raw);
}

export function previewFromLedger(state: LedgerState, exportedAt: string | null = null): BackupPreview {
  const kit = kitOf(state.settings.tradeId);
  return {
    centreName: state.settings.centreName || "Untitled books",
    kitName: kit.name,
    tradeId: kit.id,
    fy: fyLabel(state.settings.fyStartYear, state.settings.fyStartMonth ?? 3),
    studentCount: state.students.length,
    expenseRows: state.expenses.length,
    assetCount: state.assets.length,
    exportedAt,
    lastBackupAt: state.settings.lastBackupAt,
  };
}
