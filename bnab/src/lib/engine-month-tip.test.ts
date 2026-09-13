import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parseMonthTip,
  serializeMonthTip,
} from "@/lib/engine-month-tip";
import type { MonthResult } from "@/lib/budget-engine";
import { computeBudgetMonths } from "@/lib/budget-engine";

const sample: MonthResult = {
  month: "2026-01",
  rta: 1000,
  incomeToRta: 2000,
  toSavings: 0,
  totalAssigned: 1000,
  cashOverspendDebt: 0,
  heldForNext: 0,
  categories: {
    c1: {
      categoryId: "c1",
      assigned: 500,
      activity: -200,
      ccFundingIn: 0,
      available: 300,
      overspent: false,
    },
  },
};

describe("engine-month-tip", () => {
  it("round-trips MonthResult JSON", () => {
    const parsed = parseMonthTip(serializeMonthTip(sample));
    assert.deepEqual(parsed, sample);
  });

  it("rejects malformed payload", () => {
    assert.equal(parseMonthTip("{}"), null);
    assert.equal(parseMonthTip("not-json"), null);
  });

  it("continueFrom tip matches full walk tip month", () => {
    const accounts = [
      { id: "a1", onBudget: true, type: "CHECKING", creditCategoryId: null },
    ];
    const categories = [
      {
        id: "c1",
        isIncome: false,
        isSystem: false,
        systemKey: null,
      },
      {
        id: "inc",
        isIncome: true,
        isSystem: false,
        systemKey: null,
      },
    ];
    const transactions = [
      {
        id: "t1",
        accountId: "a1",
        date: "2026-01-05",
        amount: 5000,
        categoryId: "inc",
        isParent: false,
        isChild: false,
        transferTwinId: null,
        isStartingBalance: false,
      },
      {
        id: "t2",
        accountId: "a1",
        date: "2026-02-05",
        amount: -500,
        categoryId: "c1",
        isParent: false,
        isChild: false,
        transferTwinId: null,
        isStartingBalance: false,
      },
    ];
    const assigned = [
      { categoryId: "c1", month: "2026-01", assigned: 1000 },
      { categoryId: "c1", month: "2026-02", assigned: 800 },
    ];
    const full = computeBudgetMonths({
      firstMonth: "2026-01",
      endMonth: "2026-02",
      accounts,
      categories,
      transactions,
      assigned,
    });
    const tipOnly = computeBudgetMonths({
      firstMonth: "2026-02",
      endMonth: "2026-02",
      accounts,
      categories,
      transactions: transactions.filter((t) => t.date.startsWith("2026-02")),
      assigned: assigned.filter((a) => a.month === "2026-02"),
      continueFrom: full[0],
    });
    assert.equal(tipOnly[0]?.rta, full[1]?.rta);
    assert.equal(
      tipOnly[0]?.categories.c1.available,
      full[1]?.categories.c1.available,
    );
  });
});
