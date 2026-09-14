import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  inspectBackupFile,
  type BackupPreview,
} from "@/lib/ledger/backup";
import type { LedgerState } from "@/lib/ledger/types";

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const day = iso.slice(0, 10);
  const [y, m, d] = day.split("-");
  if (!y) return iso;
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m) - 1]} ${y}`;
}

export function RestorePanel({
  onRestore,
  confirmLabel = "Replace books in this browser",
  emptyHint,
}: {
  onRestore: (ledger: LedgerState) => void;
  confirmLabel?: string;
  emptyHint?: ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [over, setOver] = useState(false);
  const [pending, setPending] = useState<{ ledger: LedgerState; preview: BackupPreview } | null>(
    null,
  );

  async function takeFile(file: File | undefined) {
    setError(null);
    setOk(false);
    setPending(null);
    if (!file) return;
    try {
      const inspected = await inspectBackupFile(file);
      setPending({ ledger: inspected.ledger, preview: inspected.preview });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that backup.");
    }
  }

  function confirm() {
    if (!pending) return;
    onRestore(pending.ledger);
    setPending(null);
    setOk(true);
  }

  function onDrag(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setOver(true);
    if (e.type === "dragleave") setOver(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    void takeFile(e.dataTransfer.files?.[0]);
  }

  const exported = pending ? formatWhen(pending.preview.exportedAt) : null;

  return (
    <div>
      <div
        onDragEnter={onDrag}
        onDragOver={onDrag}
        onDragLeave={onDrag}
        onDrop={onDrop}
        className={`rounded-md border border-dashed px-3 py-4 ${
          over ? "border-primary bg-primary/5" : "border-border bg-muted/30"
        }`}
      >
        <p className="text-sm">Drop a .json backup here, or choose a file.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Excel .xlsx files will be refused — that file is for the accountant, not for restore.
        </p>
        <div className="mt-3">
          <Button variant="outline" className="h-11" onClick={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Choose backup
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,.csv"
          className="hidden"
          onChange={(e) => {
            void takeFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>
      {pending ? (
        <div className="mt-4 rounded-md border border-border bg-card px-3 py-3">
          <p className="text-sm font-medium">Open “{pending.preview.centreName}”?</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {pending.preview.kitName} · {pending.preview.fy} · {pending.preview.studentCount} on the
            register · {pending.preview.expenseRows} cost rows · {pending.preview.assetCount} assets
            {exported ? ` · saved ${exported}` : ""}. This replaces whatever is currently in this
            browser. It does not upload anything.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={confirm}>
              {confirmLabel}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        emptyHint
      )}
      {error ? <p className="mt-3 text-[13px] text-loss">{error}</p> : null}
      {ok ? (
        <p className="mt-3 text-[13px] text-profit">Backup is now the live books in this browser.</p>
      ) : null}
    </div>
  );
}
