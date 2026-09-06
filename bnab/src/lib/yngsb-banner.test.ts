import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeYngsbBanner, computeYngsbBannerChain } from "./yngsb-banner";
import type { MonthResult } from "@/lib/budget-engine";

function emptyPlan(month: string, patch: Partial<MonthResult> = {}): MonthResult {
  return {
    month,
    rta: 0,
    incomeToRta: 0,
    totalAssigned: 0,
    cashOverspendDebt: 0,
    categories: {},
    ...patch,
  };
}

describe("YNGSB banner metrics", () => {
  it("matches Code.gs formulas for first month", () => {
    const plan = emptyPlan("2026-09", {
      incomeToRta: 100_000,
      totalAssigned: 40_000,
      rta: 60_000,
      categories: {
        a: {
          categoryId: "a",
          assigned: 40_000,
          activity: -25_000,
          available: 15_000,
          ccFundingIn: 0,
          overspent: false,
        },
      },
    });
    const m = computeYngsbBanner(plan, ["a"], 0);
    assert.equal(m.notBudgeted, 0);
    assert.equal(m.spent, 25_000);
    assert.equal(m.overallIncome, 100_000);
    assert.equal(m.budgeted, 40_000);
    // Remaining = 0 - 25000 + 100000
    assert.equal(m.remaining, 75_000);
    // Available = 100000 - 40000 + 0
    assert.equal(m.available, 60_000);
  });

  it("carries Available into next Not Budgeted", () => {
    const m1 = emptyPlan("2026-08", {
      incomeToRta: 80_000,
      totalAssigned: 50_000,
      categories: {
        a: {
          categoryId: "a",
          assigned: 50_000,
          activity: -10_000,
          available: 40_000,
          ccFundingIn: 0,
          overspent: false,
        },
      },
    });
    const m2 = emptyPlan("2026-09", {
      incomeToRta: 50_000,
      totalAssigned: 30_000,
      categories: {
        a: {
          categoryId: "a",
          assigned: 30_000,
          activity: -5_000,
          available: 25_000,
          ccFundingIn: 0,
          overspent: false,
        },
      },
    });
    const chain = computeYngsbBannerChain([m1, m2], ["a"]);
    // Available m1 = 80k - 50k + 0 = 30k
    assert.equal(chain.get("2026-08")!.available, 30_000);
    assert.equal(chain.get("2026-09")!.notBudgeted, 30_000);
    // Available m2 = 50k - 30k + 30k = 50k
    assert.equal(chain.get("2026-09")!.available, 50_000);
  });
});
