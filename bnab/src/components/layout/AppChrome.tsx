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
} from "lucide-react";

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
      <aside className="hidden w-56 shrink-0 border-r border-rim/60 bg-surface/90 backdrop-blur-sm md:flex md:flex-col">
        <div className="border-b border-rim/60 px-5 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-fg-subtle">
            BNAB
          </p>
          <p className="mt-1 truncate text-sm font-medium text-fg">{budgetName}</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {desktopLinks.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/transactions"
                ? wideRegister
                : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                prefetch
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-accent-muted text-accent"
                    : "text-fg-muted hover:bg-overlay hover:text-fg"
                }`}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
          <Link
            href="/transactions/new"
            className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-full bg-accent px-3 py-2.5 text-sm font-medium text-accent-fg hover:bg-accent-hover"
            style={{
              boxShadow: "0 8px 24px color-mix(in oklch, var(--glow-accent) 55%, transparent)",
            }}
          >
            <Plus className="size-4" />
            Add transaction
          </Link>
          <Link
            href="/more"
            className={`mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
              pathname.startsWith("/more")
                ? "bg-accent-muted text-accent"
                : "text-fg-muted hover:bg-overlay hover:text-fg"
            }`}
          >
            <MoreHorizontal className="size-5" />
            More
          </Link>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-rim/60 bg-canvas/80 px-4 backdrop-blur-md md:hidden">
          <p className="text-sm font-semibold tracking-tight text-fg">BNAB</p>
          <p className="ml-2 truncate text-sm text-fg-muted">{budgetName}</p>
        </header>
        <main
          className={`mx-auto w-full flex-1 px-3 py-4 sm:px-5 md:py-8 ${
            wideRegister ? "max-w-6xl md:px-6" : "max-w-3xl md:px-8"
          }`}
        >
          {children}
        </main>
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
                    className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg"
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
                  className={`flex min-h-12 min-w-[4.25rem] flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[11px] font-medium ${
                    active ? "text-accent" : "text-fg-muted"
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
