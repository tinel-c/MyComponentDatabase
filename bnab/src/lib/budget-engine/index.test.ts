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

  it("applies balance adjustments to Ready to Assign", () => {
    const checking = {
      id: "chk",
      onBudget: true,
      type: "CHECKING",
      creditCategoryId: null,
    };
    const income = {
      id: "inc",
      isIncome: true,
      isSystem: false,
      systemKey: null,
    };

    const results = computeBudgetMonths({
      firstMonth: "2026-09",
      endMonth: "2026-09",
      accounts: [checking],
      categories: [income],
      transactions: [
        {
          id: "up",
          accountId: "chk",
          date: "2026-09-01",
          amount: 50_000,
          categoryId: "inc",
          isParent: false,
          isChild: false,
          transferTwinId: null,
          isStartingBalance: false,
        },
        {
          id: "down",
          accountId: "chk",
          date: "2026-09-02",
          amount: -12_000,
          categoryId: null,
          isParent: false,
          isChild: false,
          transferTwinId: null,
          isStartingBalance: false,
        },
      ],
      assigned: [],
    });

    const m = results[0];
    assert.equal(m.incomeToRta, 38_000);
    assert.equal(m.rta, 38_000);
  });

  it("excludes ignore-matched transactions from Ready to Assign", () => {
    const checking = {
      id: "chk",
      onBudget: true,
      type: "CHECKING",
      creditCategoryId: null,
    };
    const income = {
      id: "inc",
      isIncome: true,
      isSystem: false,
      systemKey: null,
    };

    const results = computeBudgetMonths({
      firstMonth: "2026-09",
      endMonth: "2026-09",
      accounts: [checking],
      categories: [income],
      transactions: [
        {
          id: "pay",
          accountId: "chk",
          date: "2026-09-01",
          amount: 100_000,
          categoryId: "inc",
          isParent: false,
          isChild: false,
          transferTwinId: null,
          isStartingBalance: false,
        },
        {
          id: "credit-line",
          accountId: "chk",
          date: "2026-09-02",
          amount: 11_417,
          categoryId: null,
          isParent: false,
          isChild: false,
          transferTwinId: null,
          isStartingBalance: false,
          excludeFromRta: true,
        },
      ],
      assigned: [],
    });

    assert.equal(results[0].incomeToRta, 100_000);
    assert.equal(results[0].rta, 100_000);
  });

  it("scales over many months without changing fixture results", () => {
    const checking = {
      id: "chk",
      onBudget: true,
      type: "CHECKING",
      creditCategoryId: null,
    };
    const groc = {
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

    const transactions = [];
    const assigned = [];
    let y = 2025;
    let mo = 1;
    for (let i = 0; i < 24; i++) {
      const m = `${y}-${String(mo).padStart(2, "0")}`;
      transactions.push({
        id: `inc-${m}`,
        accountId: "chk",
        date: `${m}-01`,
        amount: 100_000,
        categoryId: "inc",
        isParent: false,
        isChild: false,
        transferTwinId: null,
        isStartingBalance: false,
      });
      transactions.push({
        id: `groc-${m}`,
        accountId: "chk",
        date: `${m}-15`,
        amount: -20_000,
        categoryId: "groc",
        isParent: false,
        isChild: false,
        transferTwinId: null,
        isStartingBalance: false,
      });
      for (let n = 0; n < 50; n++) {
        transactions.push({
          id: `noise-${m}-${n}`,
          accountId: "chk",
          date: `${m}-10`,
          amount: -100,
          categoryId: "groc",
          isParent: false,
          isChild: false,
          transferTwinId: null,
          isStartingBalance: false,
        });
      }
      assigned.push({ categoryId: "groc", month: m, assigned: 50_000 });
      mo += 1;
      if (mo > 12) {
        mo = 1;
        y += 1;
      }
    }

    const results = computeBudgetMonths({
      firstMonth: "2025-01",
      endMonth: "2026-12",
      accounts: [checking],
      categories: [groc, income],
      transactions,
      assigned,
    });

    assert.equal(results.length, 24);
    const last = results[23];
    // activity = -20_000 + 50*-100 = -25_000
    assert.equal(last.categories.groc.activity, -25_000);
    assert.equal(last.incomeToRta, 100_000);
    assert.equal(last.totalAssigned, 50_000);
  });
});
