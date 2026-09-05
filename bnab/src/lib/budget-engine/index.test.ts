import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeBudgetMonths } from "./index";

describe("computeBudgetMonths", () => {
  it("assigns income to RTA then to categories", () => {
    const checking = {
      id: "chk",
      onBudget: true,
      type: "CHECKING",
      creditCategoryId: null,
    };
    const groceries = {
      id: "groc",
      isIncome: false,
      isSystem: false,
      systemKey: null,
    };
    const income = {
      id: "inc",
      isIncome: true,
      isSystem: false,
      systemKey: null,
    };

    const results = computeBudgetMonths({
      firstMonth: "2026-03",
      endMonth: "2026-03",
      accounts: [checking],
      categories: [groceries, income],
      transactions: [
        {
          id: "t1",
          accountId: "chk",
          date: "2026-03-01",
          amount: 800_000,
          categoryId: "inc",
          isParent: false,
          isChild: false,
          transferTwinId: null,
          isStartingBalance: false,
        },
        {
          id: "t2",
          accountId: "chk",
          date: "2026-03-05",
          amount: -18_000,
          categoryId: "groc",
          isParent: false,
          isChild: false,
          transferTwinId: null,
          isStartingBalance: false,
        },
      ],
      assigned: [{ categoryId: "groc", month: "2026-03", assigned: 150_000 }],
    });

    const m = results[0];
    assert.equal(m.incomeToRta, 800_000);
    assert.equal(m.totalAssigned, 150_000);
    assert.equal(m.rta, 650_000);
    assert.equal(m.categories.groc.activity, -18_000);
    assert.equal(m.categories.groc.available, 150_000 - 18_000);
  });

  it("funds credit card payment category on card spend", () => {
    const card = {
      id: "cc",
      onBudget: true,
      type: "CREDIT_CARD",
      creditCategoryId: "ccp",
    };
    const checking = {
      id: "chk",
      onBudget: true,
      type: "CHECKING",
      creditCategoryId: null,
    };
    const groceries = {
      id: "groc",
      isIncome: false,
      isSystem: false,
      systemKey: null,
    };
    const ccp = {
      id: "ccp",
      isIncome: false,
      isSystem: true,
      systemKey: "cc-payment",
    };

    const results = computeBudgetMonths({
      firstMonth: "2026-03",
      endMonth: "2026-03",
      accounts: [card, checking],
      categories: [groceries, ccp],
      transactions: [
        {
          id: "t1",
          accountId: "cc",
          date: "2026-03-02",
          amount: -5_000,
          categoryId: "groc",
          isParent: false,
          isChild: false,
          transferTwinId: null,
          isStartingBalance: false,
        },
      ],
      assigned: [{ categoryId: "groc", month: "2026-03", assigned: 10_000 }],
    });

    const m = results[0];
    assert.equal(m.categories.groc.available, 5_000);
    assert.equal(m.categories.ccp.ccFundingIn, 5_000);
    assert.equal(m.categories.ccp.available, 5_000);
  });

  it("carries positive available to next month", () => {
    const checking = {
      id: "chk",
      onBudget: true,
      type: "CHECKING",
      creditCategoryId: null,
    };
    const cat = {
      id: "c1",
      isIncome: false,
      isSystem: false,
      systemKey: null,
    };

    const results = computeBudgetMonths({
      firstMonth: "2026-01",
      endMonth: "2026-02",
      accounts: [checking],
      categories: [cat],
      transactions: [],
      assigned: [
        { categoryId: "c1", month: "2026-01", assigned: 10_000 },
        { categoryId: "c1", month: "2026-02", assigned: 0 },
      ],
    });

    assert.equal(results[0].categories.c1.available, 10_000);
    assert.equal(results[1].categories.c1.available, 10_000);
  });
});
