import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { money, parseAmount } from "@/lib/ledger/format";
import type { CurrencyCode } from "@/lib/ledger/types";

export function AmountCell({
  value,
  currency,
  editable,
  muted,
  bold,
  negative,
  selected,
  onSelect,
  onChange,
  placeholder = "—",
}: {
  value: number;
  currency: CurrencyCode;
  editable?: boolean;
  muted?: boolean;
  bold?: boolean;
  negative?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onChange?: (value: number) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isNeg = negative || value < 0;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function startEdit() {
    if (!editable) return;
    setDraft(value === 0 ? "" : String(value));
    setEditing(true);
    onSelect?.();
  }

  function commit() {
    const next = parseAmount(draft);
    onChange?.(next);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        inputMode="decimal"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-full w-full bg-sheet px-2 text-right font-mono text-[13px] tabular-nums outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        onSelect?.();
        if (editable) startEdit();
      }}
      onDoubleClick={startEdit}
      className={cn(
        "flex h-full w-full items-center justify-end px-2 font-mono text-[13px] tabular-nums",
        muted && "text-muted-foreground",
        bold && "font-medium",
        isNeg && "text-loss",
        selected && "bg-primary/10",
        editable ? "hover:bg-muted/60" : "cursor-default",
      )}
    >
      {value === 0 && !bold ? (
        <span className="text-muted-foreground/50">{placeholder}</span>
      ) : (
        money(value, currency)
      )}
    </button>
  );
}
