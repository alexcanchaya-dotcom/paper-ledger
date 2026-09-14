import { useEffect, useState } from "react";
import {
  Bell,
  BookOpen,
  Calculator,
  FileDown,
  Landmark,
  LayoutDashboard,
  MoreHorizontal,
  Settings2,
  Table2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fyLabel } from "@/lib/ledger/format";
import { openDeskCount } from "@/lib/ledger/reminders";
import { backupHealth } from "@/lib/ledger/reports";
import { useLedger } from "@/lib/ledger/store";
import { kitOf } from "@/lib/ledger/kits";
import { Onboarding } from "./Onboarding";
import { AssetsSheet } from "./AssetsSheet";
import { ExportSheet } from "./ExportSheet";
import { FollowUpsSheet } from "./FollowUpsSheet";
import { OverviewSheet } from "./OverviewSheet";
import { PnlSheet } from "./PnlSheet";
import { SettingsSheet } from "./SettingsSheet";
import { StudentsSheet } from "./StudentsSheet";
import { TaxSheet } from "./TaxSheet";

export type SheetId = "overview" | "desk" | "students" | "pnl" | "assets" | "tax" | "export" | "settings";

const PRIMARY: SheetId[] = ["overview", "desk", "students", "pnl"];

export function Workbook() {
  const [sheet, setSheet] = useState<SheetId>("overview");
  const [moreOpen, setMoreOpen] = useState(false);
  const settings = useLedger((s) => s.settings);
  const deskDue = useLedger((s) => openDeskCount(s));
  const lastBackupAt = useLedger((s) => s.settings.lastBackupAt);
  const hydrated = useLedger((s) => s.hydrated);
  const backup = backupHealth({ settings: { lastBackupAt } } as Parameters<typeof backupHealth>[0]);
  const kit = kitOf(settings.tradeId);

  const groups: { label: string; items: { id: SheetId; label: string; icon: typeof LayoutDashboard }[] }[] = [
    {
      label: "Operate",
      items: [
        { id: "overview", label: kit.id === "tuition" ? "Centre" : "Overview", icon: LayoutDashboard },
        { id: "desk", label: "Desk", icon: Bell },
      ],
    },
    {
      label: "Books",
      items: [
        { id: "students", label: kit.customers, icon: Users },
        { id: "pnl", label: "P&L", icon: Table2 },
        { id: "assets", label: "Assets", icon: Landmark },
        { id: "tax", label: "Tax", icon: Calculator },
      ],
    },
    {
      label: "Takeaway",
      items: [
        { id: "export", label: "Export", icon: FileDown },
        { id: "settings", label: "Settings", icon: Settings2 },
      ],
    },
  ];

  const allItems = groups.flatMap((g) => g.items);
  const moreItems = allItems.filter((i) => !PRIMARY.includes(i.id));

  useEffect(() => {
    const result = useLedger.persist.rehydrate();
    void Promise.resolve(result).then(
      () => useLedger.getState().setHydrated(true),
      () => useLedger.getState().setHydrated(true),
    );
  }, []);

  if (!settings.onboarded) {
    return <Onboarding ready={hydrated} />;
  }

  function go(id: SheetId) {
    setSheet(id);
    setMoreOpen(false);
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="no-print hidden h-dvh sticky top-0 flex-col border-r border-border bg-card lg:flex">
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg leading-tight font-semibold tracking-tight">Paper Ledger</p>
            <p className="truncate text-xs text-muted-foreground">{kit.name}</p>
          </div>
        </div>
        <div className="px-4 pb-3">
          <p className="truncate text-sm font-medium">{settings.centreName || "New books"}</p>
          <p className="text-xs text-muted-foreground">
            {fyLabel(settings.fyStartYear, settings.fyStartMonth ?? 3)}
          </p>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-2 pb-1 text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const on = sheet === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => go(item.id)}
                        className={`flex h-10 w-full items-center gap-2 rounded-md px-3 text-sm transition-colors duration-150 ${
                          on
                            ? "bg-secondary text-secondary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className="flex-1 truncate text-left">{item.label}</span>
                        {item.id === "desk" && deskDue > 0 ? (
                          <span className="min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center font-mono text-[10px] font-medium text-primary-foreground tabular-nums">
                            {deskDue}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        {backup.stale ? (
          <button
            type="button"
            onClick={() => go("export")}
            className="m-3 rounded-md border border-primary/25 bg-primary/5 px-3 py-2 text-left text-xs text-foreground"
          >
            {backup.lastBackupAt ? "Backup is a week or more old." : "No backup on this device yet."} Save one before you change computers.
          </button>
        ) : null}
      </aside>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-sm lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <BookOpen className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-lg leading-tight font-semibold tracking-tight">Paper Ledger</p>
                <p className="truncate text-xs text-muted-foreground">
                  {settings.centreName || "New books"} · {fyLabel(settings.fyStartYear, settings.fyStartMonth ?? 3)}
                </p>
              </div>
            </div>
            <Button variant={sheet === "export" ? "default" : "outline"} size="sm" className="shrink-0" onClick={() => go("export")}>
              <FileDown className="size-4" />
            </Button>
          </div>
        </header>

        <header className="no-print hidden items-center justify-between gap-3 border-b border-border bg-background/90 px-6 py-3 backdrop-blur-sm lg:flex">
          <div className="min-w-0">
            <p className="text-xs tracking-[0.14em] text-muted-foreground uppercase">
              {allItems.find((i) => i.id === sheet)?.label}
            </p>
            <p className="truncate font-display text-lg font-semibold tracking-tight">
              {settings.centreName || "New books"}
            </p>
          </div>
          <Button variant={sheet === "export" ? "default" : "outline"} size="sm" onClick={() => go("export")}>
            <FileDown className="size-4" />
            Export
          </Button>
        </header>

        <main className="mx-auto max-w-[1400px] px-4 py-5 pb-24 sm:px-6 sm:py-7 lg:pb-7">
          {sheet === "overview" ? <OverviewSheet onOpenSheet={(id) => go(id as SheetId)} /> : null}
          {sheet === "desk" ? <FollowUpsSheet /> : null}
          {sheet === "students" ? <StudentsSheet /> : null}
          {sheet === "pnl" ? <PnlSheet /> : null}
          {sheet === "assets" ? <AssetsSheet /> : null}
          {sheet === "tax" ? <TaxSheet /> : null}
          {sheet === "export" ? <ExportSheet /> : null}
          {sheet === "settings" ? <SettingsSheet /> : null}
        </main>
      </div>

      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-sm lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <ul className="grid grid-cols-5">
          {PRIMARY.map((id) => {
            const item = allItems.find((i) => i.id === id);
            if (!item) return null;
            const Icon = item.icon;
            const on = sheet === id;
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => go(id)}
                  className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] ${
                    on ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  <span className="relative">
                    <Icon className="size-5" />
                    {id === "desk" && deskDue > 0 ? (
                      <span className="absolute -top-1 -right-2 min-w-4 rounded-full bg-primary px-1 text-center font-mono text-[9px] text-primary-foreground">
                        {deskDue}
                      </span>
                    ) : null}
                  </span>
                  {item.label}
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              className={`flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] ${
                moreOpen || moreItems.some((i) => i.id === sheet) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <MoreHorizontal className="size-5" />
              More
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-secondary/40" aria-label="Close menu" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-xl border border-border bg-card p-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">More</p>
              <button type="button" className="grid size-10 place-items-center rounded-md hover:bg-muted" onClick={() => setMoreOpen(false)} aria-label="Close">
                <X className="size-4" />
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const on = sheet === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => go(item.id)}
                      className={`flex h-14 w-full items-center gap-2 rounded-md border px-3 text-sm ${
                        on ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <Icon className="size-4" />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
