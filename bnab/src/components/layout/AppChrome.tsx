"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  PiggyBank,
  Plus,
  BarChart3,
  MoreHorizontal,
  ArrowLeftRight,
  Receipt,
} from "lucide-react";
import { BnabLogo } from "@/components/brand/BnabLogo";
import { InstallAppPrompt } from "@/components/pwa/InstallAppPrompt";

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
  { href: "/more/import-bill", label: "Import bill", icon: Receipt },
  { href: "/reflect", label: "Reflect", icon: BarChart3 },
];

export function AppChrome({
  children,
  budgetName,
}: {
  children: React.ReactNode;
  budgetName: string;
}) {
  const pathname = usePathname();
  const wideRegister =
    pathname === "/transactions" ||
    (pathname.startsWith("/transactions/") &&
      !pathname.startsWith("/transactions/new"));

  return (
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
          {desktopLinks.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/transactions"
                ? wideRegister
                : href === "/more/import-bill"
                  ? pathname.startsWith("/more/import-bill")
                  : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                prefetch
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
                  active
                    ? "bg-accent-muted text-accent shadow-sm"
                    : "text-fg-muted hover:bg-overlay/80 hover:text-fg"
                }`}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
          <Link
            href="/more"
            prefetch
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
              pathname.startsWith("/more") &&
              !pathname.startsWith("/more/import-bill")
                ? "bg-accent-muted text-accent shadow-sm"
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
              boxShadow: "0 8px 24px color-mix(in oklch, var(--glow-accent) 55%, transparent)",
            }}
          >
            <Plus className="size-4" />
            Add transaction
          </Link>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2.5 border-b border-rim/60 bg-canvas/80 px-4 backdrop-blur-md md:hidden">
          <Link href="/plan" className="min-w-0">
            <BnabLogo compact showTagline={false} markClassName="size-7" />
          </Link>
          <p className="min-w-0 flex-1 truncate text-xs text-fg-muted">{budgetName}</p>
        </header>
        <main className="mx-auto w-full max-w-none flex-1 px-3 py-4 sm:px-5 md:px-6 md:py-6 lg:px-8">
          {children}
        </main>
        <InstallAppPrompt />
      </div>

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
  );
}
