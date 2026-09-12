import Link from "next/link";
import { requireAdmin, requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  buttonPrimaryClass,
  cardCompactClass,
  inputClass,
  labelClass,
  pageStackClass,
  sectionSubheadingClass,
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
    <div className={pageStackClass}>
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-fg md:text-2xl">Team</h1>
        <p className={sectionSubheadingClass}>
          Invite your partner by Google email. They must sign in with that account.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-2 lg:items-start">
        <ul className={`${cardCompactClass} divide-y divide-rim-subtle`}>
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-fg">
                  {m.user.email}
                </p>
                <p className="text-xs text-fg-subtle">{m.user.name ?? "—"}</p>
              </div>
              <span className="shrink-0 text-[10px] font-medium uppercase text-fg-muted">
                {m.role}
              </span>
            </li>
          ))}
        </ul>

        <form action={inviteMember} className={`${cardCompactClass} space-y-2 p-3`}>
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
