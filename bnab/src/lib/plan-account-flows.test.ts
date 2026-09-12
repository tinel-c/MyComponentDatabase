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
  ]);

  it("sums income and spending per on-budget account for the month", () => {
    const { incomeByAccount, spendingByAccount } = computeAccountMonthFlows({
      month: "2026-09",
      accountOnBudget,
      categoryIsIncome,
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
    assert.equal(spendingByAccount.checking, -12_500);
    assert.equal(incomeByAccount.off, undefined);
  });
});
