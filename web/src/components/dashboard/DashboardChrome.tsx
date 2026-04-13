"use client";

import { signOutAction } from "@/app/actions/auth";
import { ThemeSelector } from "@/components/ui/ThemeSelector";
import type { Session } from "next-auth";
import {
  Boxes,
  ClipboardList,
  Database,
  FolderTree,
  LogOut,
  MapPin,
  Menu,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navBase = [
  { href: "/parts", label: "Parts", icon: Boxes },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/locations", label: "Locations", icon: MapPin },
];

export function DashboardChrome({
  session,
  gravatarUrl,
  children,
}: {
  session: Session;
  /** Gravatar URL derived from the user email (see `getGravatarUrl`). */
  gravatarUrl: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isAdmin = session.user.role === "ADMIN";
  const nav = isAdmin
    ? [
        ...navBase,
        { href: "/admin/users", label: "Team", icon: Users },
        { href: "/admin/audit", label: "Audit log", icon: ClipboardList },
        { href: "/admin/sync", label: "Database sync", icon: Database },
      ]
    : navBase;

  useEffect(() => {
    if (!mobileNavOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileNavOpen]);

  const closeNav = () => setMobileNavOpen(false);

  return (
    <div className="flex min-h-[calc(100vh-0px)] bg-canvas">
      {mobileNavOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-label="Close menu"
          onClick={closeNav}
        />
      ) : null}

      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside
        style={{
          background: `linear-gradient(to bottom, var(--sidebar-from), var(--sidebar-via), var(--sidebar-to))`,
          borderRightColor: "var(--rim)",
          boxShadow: `0 0 40px var(--glow-accent)`,
        }}
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(100vw,16rem)] flex-col border-r text-fg shadow-xl transition-transform duration-200 ease-out md:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Close button (mobile) */}
        <button
          type="button"
          onClick={closeNav}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-fg-muted hover:bg-fg/10 hover:text-fg md:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Logo / brand */}
        <div
          className="flex h-20 shrink-0 items-center border-b px-4 pr-12 md:pr-4"
          style={{ borderBottomColor: "var(--rim-subtle)" }}
        >
          <Link href="/parts" className="block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-xl">
            <div className="rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,1)" }}>
              <Image
                src="/logo.png"
                alt="Hobby Warehouse"
                width={2013}
                height={597}
                className="h-auto w-full object-contain"
                priority
              />
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/parts"
                ? pathname === href ||
                  pathname.startsWith("/parts/") ||
                  pathname.startsWith("/p/")
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={closeNav}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150"
                style={
                  active
                    ? {
                        background: "var(--accent-muted)",
                        color: "var(--accent)",
                        boxShadow: `inset 0 0 0 1px var(--accent-muted)`,
                      }
                    : {
                        color: "var(--fg-muted)",
                      }
                }
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background =
                      "color-mix(in oklch, var(--fg) 5%, transparent)";
                    (e.currentTarget as HTMLElement).style.color = "var(--fg)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "";
                    (e.currentTarget as HTMLElement).style.color =
                      "var(--fg-muted)";
                  }
                }}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom: theme selector + user block + sign out */}
        <div
          className="border-t p-3 space-y-3"
          style={{ borderTopColor: "var(--rim-subtle)" }}
        >
          {/* Theme selector */}
          <ThemeSelector />

          {/* User card */}
          <div
            className="flex items-center gap-3 rounded-xl p-3 ring-1 ring-rim-subtle/60"
            style={{
              background: "color-mix(in oklch, var(--fg) 4%, transparent)",
            }}
          >
            <img
              src={gravatarUrl}
              alt=""
              width={40}
              height={40}
              referrerPolicy="no-referrer"
              className="h-10 w-10 rounded-full object-cover ring-2 ring-rim/50"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-fg">
                {session.user.name ?? "User"}
              </p>
              <p
                className="truncate text-xs"
                style={{ color: "var(--fg-muted)" }}
              >
                {session.user.email}
              </p>
              <p
                className="mt-0.5 text-[10px] font-medium uppercase tracking-wider"
                style={{ color: "var(--accent)" }}
              >
                {session.user.role === "ADMIN" ? "Admin" : "Member"}
              </p>
            </div>
          </div>

          {/* Sign out */}
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all duration-150"
              style={{
                borderColor: "var(--rim)",
                color: "var(--fg-muted)",
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background =
                  "color-mix(in oklch, var(--fg) 6%, transparent)";
                el.style.color = "var(--fg)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "transparent";
                el.style.color = "var(--fg-muted)";
              }}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────── */}
      <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col md:pl-64">
        {/* Mobile header */}
        <header
          className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur-md md:hidden"
          style={{
            background: "color-mix(in oklch, var(--canvas) 95%, transparent)",
            borderBottomColor: "var(--rim)",
          }}
        >
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-fg hover:bg-fg/8"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="inline-flex rounded-lg px-2 py-1 bg-white">
              <Image
                src="/logo.png"
                alt="Hobby Warehouse"
                width={2013}
                height={597}
                className="h-7 w-auto object-contain"
                priority
              />
            </div>
          </div>
        </header>

        <main className="w-full min-w-0 flex-1 px-3 py-6 sm:px-6 md:px-8 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
