import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { auth } from "@/auth";
import {
  buttonDangerClass,
  cardClass,
} from "@/components/forms/field-classes";
import { logoutAction } from "./actions";
import { ThemeSelector } from "@/components/ui/ThemeSelector";
import { InstallAppCard } from "@/components/pwa/InstallAppPrompt";
import {
  Receipt,
  BarChart3,
  ArrowLeftRight,
  Users,
  Tags,
  Store,
  CalendarClock,
  FileSpreadsheet,
  ListFilter,
  History,
  ScanLine,
} from "lucide-react";

const links: {
  href: string;
  label: string;
  desc: string;
  icon: typeof Receipt;
  featured?: boolean;
}[] = [
  {
    href: "/more/import-bill",
    label: "Import bill",
    desc: "Photo a receipt → match bank txn → split categories",
    icon: Receipt,
    featured: true,
  },
  {
    href: "/more/bills",
    label: "Imported bills",
    desc: "Bill scans and ING / register linkage",
    icon: History,
  },
  {
    href: "/reflect",
    label: "Reflect",
    desc: "Spending trends and net worth reports",
    icon: BarChart3,
  },
  {
    href: "/transactions",
    label: "All transactions",
    desc: "Spreadsheet register — edit cells inline",
    icon: ArrowLeftRight,
  },
  {
    href: "/more/team",
    label: "Team",
    desc: "Invite your household partner",
    icon: Users,
  },
  {
    href: "/more/categories",
    label: "Categories & targets",
    desc: "Organize envelopes",
    icon: Tags,
  },
  {
    href: "/more/payees",
    label: "Payees",
    desc: "Merchant list",
    icon: Store,
  },
  {
    href: "/more/schedules",
    label: "Scheduled",
    desc: "Recurring transactions",
    icon: CalendarClock,
  },
  {
    href: "/more/import",
    label: "ING import",
    desc: "Import HomeBank ING CSV",
    icon: FileSpreadsheet,
  },
  {
    href: "/more/import-rules",
    label: "Import mappings",
    desc: "Substring → category rules",
    icon: ListFilter,
  },
  {
    href: "/more/receipt-rules",
    label: "Receipt mappings",
    desc: "Bill line → category (Gemini detailing)",
    icon: ScanLine,
  },
  {
    href: "/more/import-history",
    label: "Import history",
    desc: "Revert batches and leftovers",
    icon: History,
  },
];

export default async function MorePage() {
  const { budget } = await requireBudgetAccess();
  const session = await auth();
  const featured = links.filter((l) => l.featured);
  const rest = links.filter((l) => !l.featured);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">More</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {budget.name} · {budget.currency} · {session?.user?.email}
        </p>
      </div>

      <InstallAppCard />

      {featured.map((l) => {
        const Icon = l.icon;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`${cardClass} flex items-center gap-4 border-accent/30 bg-accent-muted/30 p-4 transition-colors hover:border-accent sm:p-5`}
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-fg">
              <Icon className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-fg">{l.label}</p>
              <p className="text-sm text-fg-muted">{l.desc}</p>
            </div>
          </Link>
        );
      })}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rest.map((l) => {
          const Icon = l.icon;
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                className={`${cardClass} flex h-full items-start gap-3 p-4 transition-colors hover:border-rim hover:bg-overlay/40`}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-overlay text-accent">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-fg">{l.label}</p>
                  <p className="mt-0.5 text-sm text-fg-muted">{l.desc}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${cardClass} p-4`}>
          <h2 className="text-sm font-semibold text-fg">Theme</h2>
          <div className="mt-3">
            <ThemeSelector />
          </div>
        </section>
        <form action={logoutAction} className={`${cardClass} flex items-center p-4`}>
          <button type="submit" className={`${buttonDangerClass} w-full`}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
