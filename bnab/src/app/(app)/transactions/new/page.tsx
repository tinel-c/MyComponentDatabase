import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { todayISO } from "@/lib/money";
import {
  buttonPrimaryClass,
  cardClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import { createTransaction } from "@/app/(app)/transactions/actions";

export default async function NewTransactionPage() {
  const { budget } = await requireBudgetAccess();
  const [accounts, groups, payees] = await Promise.all([
    prisma.financeAccount.findMany({
      where: { budgetId: budget.id, closed: false },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.categoryGroup.findMany({
      where: { budgetId: budget.id, hidden: false },
      orderBy: { sortOrder: "asc" },
      include: {
        categories: { where: { hidden: false }, orderBy: { sortOrder: "asc" } },
      },
    }),
    prisma.payee.findMany({
      where: { budgetId: budget.id },
      orderBy: { name: "asc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">
        Add transaction
      </h1>

      <form action={createTransaction} className={`${cardClass} space-y-4 p-4`}>
        <label className={labelClass}>
          Account
          <select name="accountId" required className={inputClass} defaultValue={accounts[0]?.id}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Date
          <input name="date" type="date" required className={inputClass} defaultValue={todayISO()} />
        </label>

        <label className={labelClass}>
          Amount
          <input
            name="amount"
            required
            inputMode="decimal"
            className={inputClass}
            placeholder="0.00"
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" name="inflow" value="1" className="size-4" />
          Inflow (income / refund)
        </label>

        <label className={labelClass}>
          Payee
          <input
            name="payee"
            list="payees"
            className={inputClass}
            placeholder="Merchant"
            autoComplete="off"
          />
          <datalist id="payees">
            {payees.map((p) => (
              <option key={p.id} value={p.name} />
            ))}
          </datalist>
        </label>

        <label className={labelClass}>
          Category
          <select name="categoryId" className={inputClass} defaultValue="">
            <option value="">Ready to Assign / none</option>
            {groups.map((g) => (
              <optgroup key={g.id} label={g.name}>
                {g.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Or transfer to
          <select name="transferToId" className={inputClass} defaultValue="">
            <option value="">— not a transfer —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Notes
          <input name="notes" className={inputClass} />
        </label>

        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" name="cleared" value="1" defaultChecked className="size-4" />
          Cleared
        </label>

        <button type="submit" className={`${buttonPrimaryClass} w-full`}>
          Save
        </button>
      </form>
    </div>
  );
}
