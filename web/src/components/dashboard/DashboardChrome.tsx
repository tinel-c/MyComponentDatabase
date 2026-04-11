"use client";

import { signOutAction } from "@/app/actions/auth";
import type { Session } from "next-auth";
import {
  Boxes,
  FolderTree,
  LayoutDashboard,
  LogOut,
  MapPin,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navBase = [
  { href: "/parts", label: "Parts", icon: Boxes },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/locations", label: "Locations", icon: MapPin },
];

export function DashboardChrome({
  session,
  children,
}: {
  session: Session;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdmin = session.user.role === "ADMIN";
  const nav = isAdmin
    ? [...navBase, { href: "/admin/users", label: "Team", icon: Users }]
    : navBase;

  return (
    <div className="flex min-h-[calc(100vh-0px)] bg-zinc-100 dark:bg-zinc-950">
      <aside className="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-zinc-200/80 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100 shadow-xl dark:border-zinc-800">
        <div className="flex h-16 items-center gap-2 border-b border-white/10 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 ring-1 ring-amber-400/30">
            <LayoutDashboard className="h-5 w-5 text-amber-300" aria-hidden />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Hobby Warehouse</p>
            <p className="text-[11px] text-zinc-400">Parts & stock</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/parts"
                ? pathname === href || pathname.startsWith("/parts/")
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-white/10 text-white shadow-inner ring-1 ring-white/10"
                    : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt=""
                className="h-10 w-10 rounded-full object-cover ring-2 ring-amber-400/40"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-700 text-sm font-semibold text-zinc-200">
                {(session.user.name ?? session.user.email ?? "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">
                {session.user.name ?? "User"}
              </p>
              <p className="truncate text-xs text-zinc-400">{session.user.email}</p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-300/90">
                {session.user.role === "ADMIN" ? "Admin" : "Member"}
              </p>
            </div>
          </div>
          <form action={signOutAction} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200 transition hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col pl-64">
        <main className="flex-1 px-4 py-8 sm:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
