import { useState } from "react";
import {
  Check,
  FileJson,
  FileSpreadsheet,
  Link2,
  Printer,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { RestorePanel } from "@/components/workbook/RestorePanel";
import {
  backupFilename,
  buildBackup,
  previewFromLedger,
} from "@/lib/ledger/backup";
import { buildExcelFile, downloadBlob, excelFilename, workbookManifest } from "@/lib/ledger/excel";
import { fyLabel } from "@/lib/ledger/format";
import { createKitLedger, kitOf } from "@/lib/ledger/kits";
import { backupHealth } from "@/lib/ledger/reports";
import { useLedger } from "@/lib/ledger/store";
import type { LedgerState } from "@/lib/ledger/types";

function blankTemplate(state: LedgerState): LedgerState {
  const blank = createKitLedger({
    trade: state.settings.tradeId,
    sample: false,
    name: state.settings.centreName,
    owner: state.settings.instructorName,
    city: state.settings.city,
    currency: state.settings.currency,
  });
  blank.settings = { ...state.settings, isSample: false, onboarded: true };
  return blank;
}

function appUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "Never on this device";
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y) return iso;
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1]} ${y}`;
}

export function ExportSheet() {
  const state = useLedger();
  const replaceAll = useLedger((s) => s.replaceAll);
  const markBackupSaved = useLedger((s) => s.markBackupSaved);
  const kit = kitOf(state.settings.tradeId);
  const fy = fyLabel(state.settings.fyStartYear, state.settings.fyStartMonth ?? 3);
  const [copied, setCopied] = useState<"link" | "json" | "">("");
  const [linkShown, setLinkShown] = useState("");
  const [jsonShown, setJsonShown] = useState("");
  const health = backupHealth(state);
  const livePreview = previewFromLedger(state);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const sheets = workbookManifest(state);

  function downloadExcel(source: LedgerState, filename: string) {
    downloadBlob(filename, buildExcelFile(source));
  }

  function backupPayload() {
    const at = new Date().toISOString();
    const snapshot = {
      ...state,
      settings: { ...state.settings, lastBackupAt: at },
    };
    return { at, snapshot, json: JSON.stringify(buildBackup(snapshot), null, 2) };
  }

  function downloadBackup() {
    const { at, snapshot, json } = backupPayload();
    downloadBlob(backupFilename(snapshot), new Blob([json], { type: "application/json" }));
    markBackupSaved(at);
    setJsonShown("");
  }

  async function copyBackup() {
    const { at, json } = backupPayload();
    try {
      await navigator.clipboard.writeText(json);
      markBackupSaved(at);
      setCopied("json");
      setJsonShown("");
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      setJsonShown(json);
      markBackupSaved(at);
    }
  }

  async function copyLink() {
    const url = appUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied("link");
      setLinkShown("");
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      setLinkShown(url);
    }
  }

  async function shareLink() {
    const url = appUrl();
    try {
      await navigator.share({
        title: "Paper Ledger",
        text: "A small-business books template — pick a kit and start keeping books.",
        url,
      });
    } catch {
      await copyLink();
    }
  }

  function applyRestore(ledger: LedgerState) {
    const at = new Date().toISOString();
    replaceAll({
      ...ledger,
      settings: { ...ledger.settings, onboarded: true, isSample: false, lastBackupAt: at },
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight">Export</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The live books stay in this browser until you save a backup. Excel is a working snapshot
          for the accountant. It does not come back in.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-4">
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Where the books live</p>
        <p className="mt-2 text-sm">
          {livePreview.centreName} · {livePreview.kitName} · {livePreview.fy} · {livePreview.studentCount}{" "}
          {livePreview.studentCount === 1 ? kit.customer.toLowerCase() : kit.customers.toLowerCase()}{" "}
          · {livePreview.expenseRows} cost rows · {livePreview.assetCount} assets
        </p>
        <p className={`mt-2 text-sm ${health.stale ? "text-loss" : "text-muted-foreground"}`}>
          Last backup on this device: {formatWhen(health.lastBackupAt)}
          {health.stale ? " — save one before you change computers or clear site data." : "."}
        </p>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Stored only on this device, in this browser, under this page. Nothing is uploaded. Closing
          the tab is fine. Clearing cookies, site data, or using another browser or phone starts
          empty unless you restore a .json backup.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card px-4 py-4">
        <p className="text-[11px] tracking-wide text-muted-foreground uppercase">Move to another computer</p>
        <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm leading-relaxed">
          <li>
            On this computer, click <span className="font-medium">Save backup</span>. You get a
            .json file (not the Excel file).
          </li>
          <li>Copy that file onto the other computer — email it to yourself, USB, Drive, whatever you already use.</li>
          <li>Open this same Paper Ledger page there. On the first screen choose Open a backup, or come here and restore.</li>
          <li>Check the preview (name, kit, year, headcount) then replace the books in that browser.</li>
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Excel cannot do this job. If you only take the .xlsx, the other computer will not have the
          live register, desk, or a way to keep working inside Paper Ledger.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="flex flex-col rounded-xl border border-border bg-card p-5">
          <div className="grid size-10 place-items-center rounded-lg bg-secondary text-secondary-foreground">
            <FileJson className="size-5" />
          </div>
          <h3 className="mt-4 font-display text-xl font-semibold tracking-tight">JSON backup — the live books</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Every student, fee, cost, asset, tax line, reminder and setting. This is the only file
            that can be opened back into Paper Ledger.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button className="h-11 sm:flex-1" onClick={downloadBackup}>
              Save backup
            </Button>
            <Button variant="outline" className="h-11 sm:flex-1" onClick={() => void copyBackup()}>
              {copied === "json" ? <Check className="size-4" /> : null}
              {copied === "json" ? "Copied" : "Copy backup"}
            </Button>
          </div>
          {jsonShown ? (
            <textarea
              readOnly
              value={jsonShown}
              className="mt-3 h-28 w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-[12px]"
              onFocus={(e) => e.currentTarget.select()}
            />
          ) : null}
          <div className="mt-5 border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium">Open a backup in this browser</p>
            <RestorePanel onRestore={applyRestore} />
          </div>
        </article>

        <article className="flex flex-col rounded-xl border border-border bg-card p-5">
          <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
            <FileSpreadsheet className="size-5" />
          </div>
          <h3 className="mt-4 font-display text-xl font-semibold tracking-tight">Excel — one way, for the accountant</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A working .xlsx: Dashboard, PnL, Register, Desk, Assets, Tax, Settings. Built here from
            the current books. Open in Excel, Numbers, Google Sheets or LibreOffice. Edits there do
            not flow back. Change people here, then download again.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button className="h-11 sm:flex-1" onClick={() => downloadExcel(state, excelFilename(state))}>
              Download {fy}
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:flex-1"
              onClick={() => {
                const blank = blankTemplate(state);
                downloadExcel(blank, `${kit.id}-paper-ledger-template.xlsx`);
              }}
            >
              Blank template
            </Button>
          </div>
          <div className="mt-4 grid gap-x-4 gap-y-1.5 border-t border-border pt-3 sm:grid-cols-2">
            {sheets.map((sheet) => (
              <p key={sheet.name} className="text-[12px] leading-snug text-muted-foreground">
                <span className="font-medium text-foreground">{sheet.name}</span>
                {" — "}
                {sheet.purpose}
              </p>
            ))}
          </div>
        </article>

        <article className="flex flex-col rounded-xl border border-border bg-card p-5">
          <div className="grid size-10 place-items-center rounded-lg bg-muted text-foreground">
            <Share2 className="size-5" />
          </div>
          <h3 className="mt-4 font-display text-xl font-semibold tracking-tight">Give someone the tool</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            Send this page. They pick their own kit. Their figures never mix with yours. This does
            not copy your books — only the JSON backup does that.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="h-11 sm:flex-1" onClick={() => void copyLink()}>
              {copied === "link" ? <Check className="size-4" /> : <Link2 className="size-4" />}
              {copied === "link" ? "Copied" : "Copy link"}
            </Button>
            {canShare ? (
              <Button variant="outline" className="h-11 sm:flex-1" onClick={() => void shareLink()}>
                Share
              </Button>
            ) : null}
          </div>
          {linkShown ? (
            <input
              readOnly
              value={linkShown}
              className="mt-3 h-11 w-full rounded-md border border-border bg-background px-3 font-mono text-[13px]"
              onFocus={(e) => e.currentTarget.select()}
            />
          ) : null}
        </article>

        <article className="flex flex-col rounded-xl border border-border bg-card p-5">
          <div className="grid size-10 place-items-center rounded-lg bg-muted text-foreground">
            <Printer className="size-5" />
          </div>
          <h3 className="mt-4 font-display text-xl font-semibold tracking-tight">Print a page</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            Open Centre, P&L or Tax, then print. The chrome hides. Prefer a file? Use Excel.
          </p>
          <div className="mt-4">
            <Button variant="outline" className="h-11" onClick={() => window.print()}>
              <Printer className="size-4" />
              Print
            </Button>
          </div>
        </article>
      </div>

      <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
        Browser → Excel is one way. Excel → browser does not exist. Browser → other computer is the
        .json backup. {state.settings.centreName || "This business"} · {fy} · {kit.name}.
      </p>
    </div>
  );
}
