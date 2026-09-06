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

const links = [
  {
    href: "/reflect",
    label: "Reflect",
    desc: "Spending trends and net worth reports",
  },
  {
    href: "/transactions",
    label: "All transactions",
    desc: "Spreadsheet register — edit cells inline",
  },
  { href: "/more/team", label: "Team", desc: "Invite your household partner" },
  { href: "/more/categories", label: "Categories & targets", desc: "Organize envelopes" },
  { href: "/more/payees", label: "Payees", desc: "Merchant list" },
  { href: "/more/schedules", label: "Scheduled", desc: "Recurring transactions" },
  { href: "/more/import", label: "ING import", desc: "Import HomeBank ING CSV" },
  {
    href: "/more/import-rules",
    label: "Import mappings",
    desc: "Substring → category rules",
  },
  {
    href: "/more/receipt-rules",
    label: "Receipt mappings",
    desc: "Bill line → category (Gemini detailing)",
  },
  {
    href: "/more/import-history",
    label: "Import history",
    desc: "Revert batches and leftovers",
  },
];

export default async function MorePage() {
  const { budget } = await requireBudgetAccess();
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">More</h1>
        <p className="mt-1 text-sm text-fg-muted">
          {budget.name} · {budget.currency} · {session?.user?.email}
        </p>
      </div>

      <InstallAppCard />

      <ul className={`${cardClass} divide-y divide-rim-subtle/60`}>
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="block px-4 py-4 hover:bg-overlay/50">
              <p className="font-medium text-fg">{l.label}</p>
              <p className="text-sm text-fg-muted">{l.desc}</p>
            </Link>
          </li>
        ))}
      </ul>

      <section className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold text-fg">Theme</h2>
        <div className="mt-3">
          <ThemeSelector />
        </div>
      </section>

      <form action={logoutAction}>
        <button type="submit" className={`${buttonDangerClass} w-full`}>
          Sign out
        </button>
      </form>
    </div>
  );
}
