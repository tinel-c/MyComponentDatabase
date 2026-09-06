import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  ensureYngsbCategories,
  seedDefaultImportRules,
} from "@/lib/starter-categories";
import { IngImportClient } from "@/components/import/IngImportClient";

export default async function ImportPage() {
  const { budget } = await requireBudgetAccess();
  await ensureYngsbCategories(prisma, budget.id);
  await seedDefaultImportRules(prisma, budget.id);

  const accounts = await prisma.financeAccount.findMany({
    where: { budgetId: budget.id, closed: false },
    orderBy: { sortOrder: "asc" },
  });
  const groups = await prisma.categoryGroup.findMany({
    where: { budgetId: budget.id, hidden: false },
    include: {
      categories: {
        where: { hidden: false },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { sortOrder: "asc" },
  });
  const categories = groups.flatMap((g) =>
    g.categories.map((c) => ({
      id: c.id,
      name: c.name,
      groupName: g.name,
    })),
  );

  return (
    <div className="space-y-6">
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-fg">ING CSV import</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Upload a HomeBank ING statement. Rules auto-categorize; unmatched rows
          can become mappings in one click.{" "}
          <Link href="/more/import-rules" className="text-accent hover:underline">
            Edit mappings
          </Link>
          {" · "}
          <Link href="/more/import-history" className="text-accent hover:underline">
            Import history
          </Link>
        </p>
      </div>

      <IngImportClient
        accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
        categories={categories}
        currency={budget.currency}
      />
    </div>
  );
}
