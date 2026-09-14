import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ExcelGrid({
  children,
  corner = "Account",
  yearLabels,
  months,
}: {
  children: ReactNode;
  corner?: string;
  yearLabels: string[];
  months: string[];
}) {
  return (
    <div className="sheet-scroll overflow-auto rounded-[20px] border border-border bg-sheet shadow-[0_1px_0_rgba(28,20,18,0.04),0_18px_40px_-28px_rgba(28,20,18,0.45)]">
      <table className="xl-grid min-w-[980px] w-full text-sm">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 z-30 w-52 min-w-52 bg-colhead px-3 py-2 text-left text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              {corner}
            </th>
            {months.map((m, i) => (
              <th
                key={`${m}-${i}`}
                className="min-w-[5.6rem] bg-colhead px-1 py-2 text-center font-medium text-foreground"
              >
                <div className="text-[13px]">{m}</div>
                <div className="text-[10px] font-normal text-muted-foreground">{yearLabels[i]}</div>
              </th>
            ))}
            <th className="min-w-[6.2rem] bg-colhead px-2 py-2 text-right text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              YTD
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function SectionRow({ label, colSpan = 14 }: { label: string; colSpan?: number }) {
  return (
    <tr className="bg-section">
      <td
        colSpan={colSpan}
        className="sticky left-0 bg-section px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-ink-soft uppercase"
      >
        {label}
      </td>
    </tr>
  );
}

export function GridRow({
  label,
  ytd,
  children,
  variant = "normal",
  hint,
  trailing,
}: {
  label: ReactNode;
  ytd: ReactNode;
  children: ReactNode;
  variant?: "normal" | "total" | "grand" | "formula";
  hint?: string;
  trailing?: ReactNode;
}) {
  return (
    <tr
      className={cn(
        "group",
        variant === "total" && "bg-muted/40 font-medium",
        variant === "grand" && "bg-primary/10 font-medium",
        variant === "formula" && "bg-sheet",
      )}
    >
      <td className="sticky left-0 z-10 bg-inherit px-3 py-0">
        <div className="flex min-h-10 items-center justify-between gap-2">
          <div className="min-w-0">
            <div
              className={cn(
                "truncate text-[13px]",
                variant === "grand" && "font-semibold",
                variant === "formula" && "text-formula",
              )}
            >
              {label}
            </div>
            {hint ? <div className="truncate text-[10px] text-muted-foreground">{hint}</div> : null}
          </div>
          {trailing}
        </div>
      </td>
      {children}
      <td className="bg-inherit px-2 text-right font-mono text-[13px] font-medium tabular-nums">{ytd}</td>
    </tr>
  );
}

export function MonthCell({ children, selected }: { children: ReactNode; selected?: boolean }) {
  return (
    <td className={cn("h-10 p-0", selected && "outline outline-2 outline-primary -outline-offset-1")}>
      {children}
    </td>
  );
}
