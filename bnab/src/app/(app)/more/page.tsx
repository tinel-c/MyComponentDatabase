import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  buttonDangerClass,
  cardClass,
  cardCompactClass,
  pageStackClass,
  sectionSubheadingClass,
} from "@/components/forms/field-classes";
import { logoutAction } from "./actions";
import { ThemeSelector } from "@/components/ui/ThemeSelector";
import { InstallAppCard } from "@/components/pwa/InstallAppPrompt";
import { BudgetSwitcher } from "@/components/budget/BudgetSwitcher";
import {
  Receipt,
  BarChart3,
  ArrowLeftRight,
  ArrowRightLeft,
  Users,
  Tags,
  Store,
  CalendarClock,
  FileSpreadsheet,
  ListFilter,
  History,
  ScanLine,
  Database,
  Sparkles,
  Landmark,
  Sprout,
} from "lucide-react";

type LinkItem = {
  href: string;
  label: string;
  desc: string;
  icon: typeof Receipt;
  featured?: boolean;
  adminOnly?: boolean;
};

const featured: LinkItem = {
  href: "/more/import-bill",
  label: "Import bill",
  desc: "Photo a receipt → match bank txn → split categories",
  icon: Receipt,
  featured: true,
};

const sections: { title: string; items: LinkItem[] }[] = [
  {
    title: "Budget",
    items: [
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
        href: "/plan/move",
        label: "Move money",
        desc: "Shift assigned amounts between envelopes",
        icon: ArrowRightLeft,
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
        href: "/more/loans",
        label: "Loan payoff",
        desc: "Months-to-payoff estimate for tracking liabilities",
        icon: Landmark,
      },
      {
        href: "/more/wish-farm",
        label: "Wish Farm",
        desc: "Savings goals and harvest progress",
        icon: Sprout,
      },
    ],
  },
  {
    title: "Import",
    items: [
      {
        href: "/more/bills",
        label: "Imported bills",
        desc: "Bill scans and ING / register linkage",
        icon: History,
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
    ],
  },
  {
    title: "Setup",
    items: [
      {
        href: "/more/team",
        label: "Team",
        desc: "Invite your household partner",
        icon: Users,
      },
      {
        href: "/more/fresh-start",
        label: "Fresh Start",
        desc: "Guided selective erase to reset the ledger",
        icon: Sparkles,
      },
      {
        href: "/more/data",
        label: "Data",
        desc: "Export, import, or selectively erase the database",
        icon: Database,
        adminOnly: true,
      },
    ],
  },
];

export default async function MorePage() {
  const { budget, session: budgetSession } = await requireBudgetAccess();
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const FeaturedIcon = featured.icon;
  const memberships = await prisma.budgetMember.findMany({
    where: { userId: budgetSession.user.id },
    include: { budget: { select: { id: true, name: true, currency: true } } },
    orderBy: { budget: { createdAt: "asc" } },
  });
  const budgetOptions = memberships.map((m) => m.budget);

  return (
    <div className={pageStackClass}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fg md:text-2xl">
          More
        </h1>
        <p className={sectionSubheadingClass}>
          {budget.name} · {budget.currency} · {session?.user?.email}
        </p>
      </div>

      {budgetOptions.length > 1 ? (
        <section className={`${cardCompactClass} p-3`}>
          <h2 className="text-sm font-semibold text-fg">Budgets</h2>
          <div className="mt-2">
            <BudgetSwitcher
              budgets={budgetOptions}
              currentBudgetId={budget.id}
            />
          </div>
        </section>
      ) : null}

      <InstallAppCard />

      <Link
        href={featured.href}
        className={`${cardCompactClass} flex items-center gap-3 border-accent/30 bg-accent-muted/30 p-3 transition-all duration-150 hover:border-accent active:scale-[0.99]`}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-fg">
          <FeaturedIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-fg">{featured.label}</p>
          <p className="text-xs text-fg-muted">{featured.desc}</p>
        </div>
      </Link>

      {sections.map((section) => {
        const items = section.items.filter((l) => !l.adminOnly || isAdmin);
        if (items.length === 0) return null;
        return (
          <section key={section.title} className="space-y-2">
            <h2 className="text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
              {section.title}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((l) => {
                const Icon = l.icon;
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className={`${cardCompactClass} flex h-full items-center gap-2.5 px-3 py-2.5 transition-all duration-150 hover:border-rim hover:bg-overlay/40 active:scale-[0.99]`}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-overlay text-accent">
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-fg">{l.label}</p>
                        <p className="truncate text-xs text-fg-muted">{l.desc}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <div className="grid gap-3 lg:grid-cols-2">
        <section className={`${cardCompactClass} p-3`}>
          <h2 className="text-sm font-semibold text-fg">Theme</h2>
          <div className="mt-2">
            <ThemeSelector />
          </div>
        </section>
        <form action={logoutAction} className={`${cardClass} flex items-center p-3`}>
          <button type="submit" className={`${buttonDangerClass} w-full`}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
