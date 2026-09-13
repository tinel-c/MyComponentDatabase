import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { isSaltEdgeConfigured } from "@/lib/saltedge";
import { BankConnectionsClient } from "@/components/bank/BankConnectionsClient";
import { pageStackClass, sectionSubheadingClass } from "@/components/forms/field-classes";

export default async function BankConnectionsPage() {
  const { budget } = await requireBudgetAccess();
  const configured = isSaltEdgeConfigured();

  const [accounts, connections] = await Promise.all([
    prisma.financeAccount.findMany({
      where: { budgetId: budget.id, closed: false },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
    prisma.bankProviderConnection.findMany({
      where: { budgetId: budget.id, status: { not: "destroyed" } },
      orderBy: { createdAt: "desc" },
      include: {
        accountLinks: { orderBy: { name: "asc" } },
      },
    }),
  ]);

  return (
    <div className={pageStackClass}>
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-fg">Bank connections</h1>
        <p className={sectionSubheadingClass}>
          Salt Edge Partners AIS — ING Romania first. CSV import remains at{" "}
          <Link href="/more/import" className="text-accent hover:underline">
            ING import
          </Link>
          . Setup checklist:{" "}
          <span className="text-fg">docs/salt-edge-open-banking.md</span>.
        </p>
      </div>

      <BankConnectionsClient
        configured={configured}
        currency={budget.currency}
        accounts={accounts}
        connections={connections.map((c) => ({
          id: c.id,
          providerCode: c.providerCode,
          providerName: c.providerName,
          status: c.status,
          consentExpiresAt: c.consentExpiresAt?.toISOString() ?? null,
          lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null,
          lastError: c.lastError,
          connectionId: c.connectionId,
          accountLinks: c.accountLinks.map((l) => ({
            id: l.id,
            externalAccountId: l.externalAccountId,
            name: l.name,
            nature: l.nature,
            currency: l.currency,
            balanceMinor: l.balanceMinor,
            financeAccountId: l.financeAccountId,
          })),
        }))}
      />
    </div>
  );
}
