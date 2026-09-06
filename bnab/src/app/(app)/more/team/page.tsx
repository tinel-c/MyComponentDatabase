import Link from "next/link";
import { requireAdmin, requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  buttonPrimaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import { inviteMember } from "../actions";

export default async function TeamPage() {
  await requireAdmin();
  const { budget } = await requireBudgetAccess();
  const members = await prisma.budgetMember.findMany({
    where: { budgetId: budget.id },
    include: { user: true },
    orderBy: { role: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-fg">Team</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Invite your partner by Google email. They must sign in with that account.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <ul className={`${cardClass} divide-y divide-rim-subtle`}>
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-fg">{m.user.email}</p>
                <p className="text-xs text-fg-subtle">{m.user.name ?? "—"}</p>
              </div>
              <span className="shrink-0 text-xs font-medium uppercase text-fg-muted">
                {m.role}
              </span>
            </li>
          ))}
        </ul>

        <form action={inviteMember} className={`${cardClass} space-y-3 p-4`}>
          <h2 className="text-sm font-semibold text-fg">Invite</h2>
          <label className={labelClass}>
            Email
            <input
              name="email"
              type="email"
              required
              className={inputClass}
              placeholder="partner@gmail.com"
            />
          </label>
          <button type="submit" className={`${buttonPrimaryClass} w-full sm:w-auto`}>
            Invite editor
          </button>
        </form>
      </div>
    </div>
  );
}
