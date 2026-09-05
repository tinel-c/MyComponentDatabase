import Link from "next/link";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  buttonPrimaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import { importCsv } from "../actions";

export default async function ImportPage() {
  const { budget } = await requireBudgetAccess();
  const accounts = await prisma.financeAccount.findMany({
    where: { budgetId: budget.id, closed: false },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/more" className="text-sm text-fg-muted hover:text-fg">
          ← More
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-fg">CSV import</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Format: <code className="text-accent">date,amount,payee,memo</code> — one
          row per transaction. Amounts: negative = outflow.
        </p>
      </div>

      <form action={importCsv} className={`${cardClass} space-y-3 p-4`}>
        <label className={labelClass}>
          Account
          <select name="accountId" required className={inputClass}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          CSV
          <textarea
            name="csv"
            required
            rows={12}
            className={`${inputClass} font-mono text-xs`}
            placeholder={"date,amount,payee,memo\n2026-03-01,-45.90,Lidl,Groceries"}
          />
        </label>
        <button type="submit" className={buttonPrimaryClass}>
          Import
        </button>
      </form>
    </div>
  );
}
