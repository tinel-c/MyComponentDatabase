import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeAccountMonthFlows } from "./plan-account-flows";

describe("computeAccountMonthFlows", () => {
  const accountOnBudget = new Map([
    ["checking", true],
    ["off", false],
  ]);
  const categoryIsIncome = new Map([
    ["paycheck", true],
    ["groceries", false],
    ["rent", false],
  ]);
  const categoryGroupId = new Map([
    ["groceries", "needs"],
    ["rent", "bills"],
  ]);

  it("sums income and spending per on-budget account for the month", () => {
    const { incomeByAccount, spendingByAccount, spendingByAccountByGroup } =
      computeAccountMonthFlows({
        month: "2026-09",
        accountOnBudget,
        categoryIsIncome,
        categoryGroupId,
        transactions: [
          {
            accountId: "checking",
            date: "2026-09-01",
            amount: 800_000,
            categoryId: "paycheck",
            isParent: false,
            transferTwinId: null,
            excludeFromRta: false,
          },
          {
            accountId: "checking",
            date: "2026-09-05",
            amount: -12_500,
            categoryId: "groceries",
            isParent: false,
            transferTwinId: null,
            excludeFromRta: false,
          },
          {
            accountId: "checking",
            date: "2026-09-10",
            amount: -80_000,
            categoryId: "rent",
            isParent: false,
            transferTwinId: null,
            excludeFromRta: false,
          },
          {
            accountId: "checking",
            date: "2026-08-01",
            amount: 100_000,
            categoryId: "paycheck",
            isParent: false,
            transferTwinId: null,
            excludeFromRta: false,
          },
          {
            accountId: "off",
            date: "2026-09-02",
            amount: 50_000,
            categoryId: "paycheck",
            isParent: false,
            transferTwinId: null,
            excludeFromRta: false,
          },
          {
            accountId: "checking",
            date: "2026-09-03",
            amount: -5_000,
            categoryId: "groceries",
            isParent: true,
            transferTwinId: null,
            excludeFromRta: false,
          },
        ],
      });

    assert.equal(incomeByAccount.checking, 800_000);
    assert.equal(spendingByAccount.checking, -92_500);
    assert.equal(spendingByAccountByGroup.checking?.needs, -12_500);
    assert.equal(spendingByAccountByGroup.checking?.bills, -80_000);
    assert.equal(incomeByAccount.off, undefined);
  });

  it("counts uncategorized and starting-balance amounts as income (RTA-aligned)", () => {
    const { incomeByAccount, spendingByAccount } = computeAccountMonthFlows({
      month: "2026-09",
      accountOnBudget,
      categoryIsIncome,
      categoryGroupId,
      transactions: [
        {
          accountId: "checking",
          date: "2026-09-06",
          amount: -600_200,
          categoryId: null,
          isParent: false,
          transferTwinId: null,
          excludeFromRta: false,
          isStartingBalance: false,
        },
        {
          accountId: "checking",
          date: "2026-09-01",
          amount: 50_000,
          categoryId: null,
          isParent: false,
          transferTwinId: null,
          excludeFromRta: false,
          isStartingBalance: true,
        },
        {
          accountId: "checking",
          date: "2026-09-02",
          amount: 10_000,
          categoryId: "paycheck",
          isParent: false,
          transferTwinId: null,
          excludeFromRta: false,
        },
      ],
    });

    assert.equal(incomeByAccount.checking, -600_200 + 50_000 + 10_000);
    assert.equal(spendingByAccount.checking, undefined);
  });
});
