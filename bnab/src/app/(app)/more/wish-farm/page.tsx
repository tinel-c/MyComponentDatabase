import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  pageStackClass,
  sectionSubheadingClass,
} from "@/components/forms/field-classes";
import { WishFarmClient } from "@/components/wish-farm/WishFarmClient";

export default async function WishFarmPage() {
  const { budget } = await requireBudgetAccess();
  const items = await prisma.wishItem.findMany({
    where: { budgetId: budget.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      amountCents: true,
      fundedCents: true,
      notes: true,
    },
  });

  return (
    <div className={`mx-auto max-w-lg ${pageStackClass}`}>
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-fg md:text-2xl">
          Wish Farm
        </h1>
        <p className={sectionSubheadingClass}>
          Track savings goals. Harvest increments funded progress — assign the
          same amount on Plan when you want envelopes to match.
        </p>
      </div>
      <WishFarmClient items={items} currency={budget.currency} />
    </div>
  );
}
