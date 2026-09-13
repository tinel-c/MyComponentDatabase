import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBudgetVsActualRows,
  buildReflectOpportunities,
} from "./reflect-insights";
import type { MonthResult } from "@/lib/budget-engine";

function month(
  m: string,
  cats: Record<
    string,
    Partial<MonthResult["categories"][string]> & { categoryId: string }
  >,
  extras?: Partial<MonthResult>,
): MonthResult {
  const categories: MonthResult["categories"] = {};
  for (const [id, c] of Object.entries(cats)) {
    categories[id] = {
      categoryId: id,
      assigned: c.assigned ?? 0,
      activity: c.activity ?? 0,
      ccFundingIn: 0,
      available: c.available ?? 0,
      overspent: c.overspent ?? false,
    };
  }
  return {
    month: m,
    rta: 0,
    incomeToRta: extras?.incomeToRta ?? 100_000,
    toSavings: 0,
    totalAssigned: 0,
    cashOverspendDebt: 0,
    categories,
    ...extras,
  };
}

describe("buildReflectOpportunities", () => {
  const categories = [
    { id: "groc", name: "Groceries", groupName: "Needs", isIncome: false },
    { id: "din", name: "Dining", groupName: "Wants", isIncome: false },
  ];

  it("flags overspent categories", () => {
    const months = [
      month("2026-08", {
        groc: {
          categoryId: "groc",
          assigned: 50_000,
          activity: -60_000,
          available: -10_000,
          overspent: true,
        },
      }),
    ];
    const ops = buildReflectOpportunities({
      months,
      categories,
      focusMonth: "2026-08",
      nextMonth: "2026-09",
    });
    assert.ok(ops.some((o) => o.type === "overspent" && o.categoryId === "groc"));
  });

  it("includes unlinked bills opportunity", () => {
    const months = [month("2026-08", {})];
    const ops = buildReflectOpportunities({
      months,
      categories,
      focusMonth: "2026-08",
      nextMonth: "2026-09",
      unlinkedBillCount: 3,
    });
    assert.ok(ops.some((o) => o.type === "unlinked_bills"));
  });
});

describe("buildBudgetVsActualRows", () => {
  it("returns spent and suggested for active categories", () => {
    const months = [
      month("2026-06", {
        groc: {
          categoryId: "groc",
          assigned: 40_000,
          activity: -35_000,
          available: 5_000,
        },
      }),
      month("2026-07", {
        groc: {
          categoryId: "groc",
          assigned: 40_000,
          activity: -45_000,
          available: -5_000,
          overspent: true,
        },
      }),
      month("2026-08", {
        groc: {
          categoryId: "groc",
          assigned: 40_000,
          activity: -50_000,
          available: -10_000,
          overspent: true,
        },
      }),
    ];
    const rows = buildBudgetVsActualRows({
      months,
      categories: [
        { id: "groc", name: "Groceries", groupName: "Needs", isIncome: false },
      ],
      focusMonth: "2026-08",
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].spent, 50_000);
    assert.ok(rows[0].suggested >= 50_000);
  });
});
