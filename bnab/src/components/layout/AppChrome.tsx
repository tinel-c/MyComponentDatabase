"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutGrid,
  PiggyBank,
  Plus,
  BarChart3,
  MoreHorizontal,
  ArrowLeftRight,
  ArrowRightLeft,
  Receipt,
  FileSpreadsheet,
  ChevronsLeft,
  ChevronsRight,
  PenLine,
  Wallet,
  CalendarClock,
  Loader2,
} from "lucide-react";
import { BnabLogo } from "@/components/brand/BnabLogo";
import { InstallAppPrompt } from "@/components/pwa/InstallAppPrompt";
import {
  PendingActionsProvider,
  usePendingActionsOptional,
} from "@/components/providers/PendingActionsProvider";
import type { AccountActivitySummary } from "@/lib/account-activity-summary";
import { uniqueAccountMonograms } from "@/lib/account-activity-summary";
import { accountTypeMeta } from "@/lib/ui-accents";

const ACTIVITY_RAIL_KEY = "bnab-activity-rail-collapsed";

const tabs: {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
  fab?: boolean;
  match?: (path: string) => boolean;
}[] = [
  { href: "/plan", label: "Plan", icon: LayoutGrid },
  {
    href: "/transactions",
    label: "Txns",
    icon: ArrowLeftRight,
    match: (path) =>
      path === "/transactions" ||
      (path.startsWith("/transactions/") &&
        !path.startsWith("/transactions/new")),
  },
  { href: "/transactions/new", label: "Add", icon: Plus, fab: true },
  { href: "/accounts", label: "Accounts", icon: PiggyBank },
  { href: "/more", label: "More", icon: MoreHorizontal },
];

const desktopLinks: {
  href: string;
  label: string;
  icon: typeof LayoutGrid;
}[] = [
  { href: "/plan", label: "Plan", icon: LayoutGrid },
  { href: "/accounts", label: "Accounts", icon: PiggyBank },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/planned", label: "Planned", icon: CalendarClock },
  { href: "/more/import-bill", label: "Import bill", icon: Receipt },
  { href: "/more/import", label: "ING import", icon: FileSpreadsheet },
  { href: "/reflect", label: "Reflect", icon: BarChart3 },
];

function PendingActionsRail() {
  const ctx = usePendingActionsOptional();
  if (!ctx || ctx.count === 0) return null;
  return (
    <div className="mx-3 mb-2 rounded-xl border border-rim-subtle bg-accent-muted/40 px-2.5 py-2">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        Working… {ctx.count}
      </p>
      <ul className="mt-1 max-h-24 space-y-0.5 overflow-y-auto text-xs text-fg-muted" aria-live="polite">
        {ctx.pending.map((p) => (
          <li key={p.id} className="truncate">
            {p.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
export function AccountActivityRail({
  summaries,
}: {
  summaries: AccountActivitySummary[];
}) {
  const [collapsed, setCollapsed] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVITY_RAIL_KEY);
      if (raw === "0") setCollapsed(false);
      if (raw === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(ACTIVITY_RAIL_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (summaries.length === 0) return null;
  const month = summaries[0]?.month ?? "";
  const monograms = uniqueAccountMonograms(
    summaries.map((s) => ({ id: s.accountId, name: s.accountName })),
  );

  return (
    <aside
      className={`hidden shrink-0 flex-col border-l border-rim/60 bg-surface/40 backdrop-blur-sm transition-[width] duration-200 md:flex ${
        collapsed ? "w-14" : "w-64"
      }`}
      aria-label="Account activity"
    >
      <div
        className={`flex items-center border-b border-rim/60 ${
          collapsed ? "flex-col gap-1 px-1 py-2" : "justify-between gap-2 px-3 py-3"
        }`}
      >
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
              Account activity
            </p>
            <p className="truncate text-xs text-fg-muted">{month}</p>
          </div>
        )}
        <button
          type="button"
          onClick={toggle}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-overlay hover:text-fg"
          title={collapsed ? "Expand activity" : "Collapse activity"}
          aria-expanded={hydrated ? !collapsed : undefined}
          aria-label={
            collapsed ? "Expand account activity" : "Collapse account activity"
          }
        >
          {collapsed ? (
            <ChevronsLeft className="size-4" />
          ) : (
            <ChevronsRight className="size-4" />
          )}
        </button>
      </div>

      {collapsed ? (
        <ul className="flex-1 space-y-2 overflow-y-auto px-1 py-2">
          {summaries.map((s) => {
            const meta = accountTypeMeta(s.accountType);
            const mono = monograms[s.accountId] ?? "?";
            const tip = [
              s.accountName,
              `Bills ${s.billsImported}`,
              `Manual ${s.manualEntries}`,
              `ING batches ${s.ingBatches}`,
              `ING txns ${s.ingTxnCount}`,
            ].join(" · ");
            return (
              <li key={s.accountId}>
                <Link
                  href={`/accounts/${s.accountId}`}
                  title={tip}
                  className="flex flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-fg-muted transition-colors hover:bg-accent-muted/40 hover:text-fg"
                >
                  <span
                    className="flex size-8 items-center justify-center rounded-lg text-[10px] font-bold tracking-tight"
                    style={{
                      background:
                        "color-mix(in oklch, var(--accent-muted) 55%, transparent)",
                      color: meta.accent,
                    }}
                    aria-label={s.accountName}
                  >
                    {mono}
                  </span>
                  <span className="flex flex-col items-center gap-0 font-mono text-[9px] leading-tight tabular-nums text-fg">
                    <span
                      title="Bills"
                      className="inline-flex items-center gap-0.5"
                    >
                      <Receipt className="size-2.5 opacity-60" aria-hidden />
                      {s.billsImported}
                    </span>
                    <span
                      title="Manual"
                      className="inline-flex items-center gap-0.5"
                    >
                      <PenLine className="size-2.5 opacity-60" aria-hidden />
                      {s.manualEntries}
                    </span>
                    <span
                      title="ING batches"
                      className="inline-flex items-center gap-0.5"
                    >
                      <FileSpreadsheet
                        className="size-2.5 opacity-60"
                        aria-hidden
                      />
                      {s.ingBatches}
                    </span>
                    <span title="ING txns" className="font-medium">
                      {s.ingTxnCount}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="flex-1 space-y-2 overflow-y-auto p-2">
          {summaries.map((s) => {
            const meta = accountTypeMeta(s.accountType);
            const Icon = meta.icon;
            return (
              <li
                key={s.accountId}
                className="rounded-xl border border-rim-subtle bg-canvas/40 px-2.5 py-2"
              >
                <Link
                  href={`/accounts/${s.accountId}`}
                  className="flex items-center gap-2 truncate text-sm font-medium text-fg hover:text-accent"
                >
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background:
                        "color-mix(in oklch, var(--accent-muted) 55%, transparent)",
                      color: meta.accent,
                    }}
                  >
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 truncate">{s.accountName}</span>
                </Link>
                <dl className="mt-1.5 space-y-0.5 text-xs text-fg-muted">
                  <div className="flex justify-between gap-2">
                    <dt>Bills</dt>
                    <dd className="font-mono tabular-nums text-fg">
                      {s.billsImported}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>Manual</dt>
                    <dd className="font-mono tabular-nums text-fg">
                      {s.manualEntries}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>ING batches</dt>
                    <dd className="font-mono tabular-nums text-fg">
                      {s.ingBatches}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>ING txns</dt>
                    <dd className="font-mono tabular-nums text-fg">
                      {s.ingTxnCount}
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

export function AppChrome({
  children,
  budgetName,
  activitySlot,
  plannedDueCount = 0,
}: {
  children: React.ReactNode;
  budgetName: string;
  /** Desktop activity rail — typically a Suspense-wrapped async server child. */
  activitySlot?: React.ReactNode;
  /** Active planned payments with nextDate ≤ today. */
  plannedDueCount?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const wideRegister =
    pathname === "/transactions" ||
    (pathname.startsWith("/transactions/") &&
      !pathname.startsWith("/transactions/new"));
  const onAddIncome =
    pathname.startsWith("/transactions/new") &&
    searchParams.get("inflow") === "1";
  const onMoveMoney =
    pathname === "/plan/move" || pathname.startsWith("/plan/move/");

  return (
    <PendingActionsProvider>
    <div
      className="relative flex min-h-dvh flex-col md:flex-row"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 50% at 50% -10%, var(--glow-top), transparent 70%)," +
          "radial-gradient(ellipse 40% 30% at 100% 0%, var(--glow-accent), transparent 55%)",
      }}
    >
      <aside
        className="hidden w-56 shrink-0 border-r border-rim/60 backdrop-blur-sm md:flex md:flex-col"
        style={{
          background:
            "linear-gradient(180deg, var(--sidebar-from), var(--sidebar-via) 45%, var(--sidebar-to))",
        }}
      >
        <div className="border-b border-rim/60 px-4 py-4">
          <Link href="/plan" prefetch className="block">
            <BnabLogo showTagline compact markClassName="size-7" />
          </Link>
          <p className="mt-2 truncate pl-0.5 text-xs text-fg-subtle">{budgetName}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          <PendingActionsRail />
          {desktopLinks.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/transactions"
                ? wideRegister
                : href === "/planned"
                  ? pathname === "/planned" ||
                    pathname.startsWith("/planned/") ||
                    pathname.startsWith("/more/schedules")
                  : href === "/more/import-bill"
                  ? pathname.startsWith("/more/import-bill")
                  : href === "/more/import"
                    ? pathname === "/more/import" ||
                      pathname.startsWith("/more/import/")
                    : href === "/plan"
                      ? pathname === "/plan"
                      : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                prefetch
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
                  active
                    ? "bg-accent-muted text-accent shadow-sm"
                    : "text-fg-muted hover:bg-overlay/80 hover:text-fg"
                }`}
              >
                <Icon className="size-5" />
                <span className="flex min-w-0 items-center gap-2">
                  {label}
                  {href === "/planned" && plannedDueCount > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-danger-muted px-1.5 text-[10px] font-semibold tabular-nums text-danger-fg">
                      {plannedDueCount > 99 ? "99+" : plannedDueCount}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
          <Link
            href="/more"
            prefetch
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
              pathname.startsWith("/more") &&
              !pathname.startsWith("/more/import-bill") &&
              !pathname.startsWith("/more/schedules") &&
              pathname !== "/more/import" &&
              !pathname.startsWith("/more/import/")
                ? "bg-accent-muted text-accent"
                : "text-fg-muted hover:bg-overlay/80 hover:text-fg"
            }`}
          >
            <MoreHorizontal className="size-5" />
            More
          </Link>
          <Link
            href="/transactions/new"
            className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-3 py-2.5 text-sm font-medium text-accent-fg transition-transform duration-150 hover:bg-accent-hover active:scale-95"
            style={{
              boxShadow:
                "0 8px 24px color-mix(in oklch, var(--glow-accent) 55%, transparent)",
            }}
          >
            <Plus className="size-4" />
            Add transaction
          </Link>
          <Link
            href="/transactions/new?inflow=1"
            prefetch
            className={`mt-2 flex min-h-11 items-center justify-center gap-2 rounded-full border border-rim px-3 py-2.5 text-sm font-medium transition-all duration-150 active:scale-95 ${
              onAddIncome
                ? "bg-accent-muted text-accent"
                : "text-fg-muted hover:bg-overlay/80 hover:text-fg"
            }`}
          >
            <Wallet className="size-4" />
            Add income
          </Link>
          <Link
            href="/plan/move"
            prefetch
            className={`mt-2 flex min-h-11 items-center justify-center gap-2 rounded-full border border-rim px-3 py-2.5 text-sm font-medium transition-all duration-150 active:scale-95 ${
              onMoveMoney
                ? "bg-accent-muted text-accent"
                : "text-fg-muted hover:bg-overlay/80 hover:text-fg"
            }`}
          >
            <ArrowRightLeft className="size-4" />
            Move money
          </Link>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-rim/60 bg-canvas/80 px-4 backdrop-blur-md md:hidden">
          <Link href="/plan" className="min-w-0">
            <BnabLogo compact showTagline={false} markClassName="size-7" />
          </Link>
          <p className="min-w-0 flex-1 truncate text-xs text-fg-muted">
            {budgetName}
          </p>
        </header>
        <main className="mx-auto w-full max-w-none flex-1 px-3 py-4 sm:px-5 md:px-6 md:py-6 lg:px-8">
          {children}
        </main>
        <InstallAppPrompt />
      </div>

      {activitySlot}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-rim/60 bg-surface/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-lg items-end justify-around px-1 pb-[env(safe-area-inset-bottom)] pt-1">
          {tabs.map(({ href, label, icon: Icon, fab, match }) => {
            const active = fab
              ? pathname === "/transactions/new" ||
                pathname.startsWith("/transactions/new/")
              : match
                ? match(pathname)
                : href === "/plan"
                  ? pathname === "/plan" || pathname.startsWith("/plan?")
                  : pathname === href || pathname.startsWith(href + "/");
            if (fab) {
              return (
                <li key={href} className="-mt-5">
                  <Link
                    href={href}
                    className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg transition-transform duration-150 active:scale-95"
                    style={{
                      boxShadow:
                        "0 10px 28px color-mix(in oklch, var(--glow-accent) 65%, transparent)",
                    }}
                    aria-label="Add transaction"
                  >
                    <Icon className="size-7" />
                  </Link>
                </li>
              );
            }
            return (
              <li key={href}>
                <Link
                  href={href}
                  prefetch
                  className={`flex min-h-12 min-w-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 text-[11px] font-medium transition-all duration-150 active:scale-95 ${
                    active
                      ? "bg-accent-muted text-accent"
                      : "text-fg-muted"
                  }`}
                >
                  <Icon className="size-5" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
    </PendingActionsProvider>
  );
}
