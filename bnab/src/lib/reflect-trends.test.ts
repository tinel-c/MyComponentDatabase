import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSpendTrendSeries,
  isOtherTrendSeries,
} from "./reflect-trends";

const cats = [
  {
    id: "groc",
    name: "Groceries",
    groupId: "needs",
    groupName: "Needs",
    isIncome: false,
  },
  {
    id: "din",
    name: "Dining",
    groupId: "wants",
    groupName: "Wants",
    isIncome: false,
  },
  {
    id: "fun",
    name: "Fun",
    groupId: "wants",
    groupName: "Wants",
    isIncome: false,
  },
  {
    id: "pay",
    name: "Paycheck",
    groupId: "inc",
    groupName: "Income",
    isIncome: true,
  },
];

describe("buildSpendTrendSeries", () => {
  it("stacks expenses by category and skips transfers/income/off-budget", () => {
    const months = ["2026-07", "2026-08"];
    const result = buildSpendTrendSeries({
      months,
      categories: cats,
      mode: "category",
      txns: [
        {
          date: "2026-07-05",
          amount: -5000,
          categoryId: "groc",
          transferTwinId: null,
          accountOnBudget: true,
          accountId: "a1",
        },
        {
          date: "2026-08-05",
          amount: -3000,
          categoryId: "groc",
          transferTwinId: null,
          accountOnBudget: true,
          accountId: "a1",
        },
        {
          date: "2026-07-10",
          amount: -2000,
          categoryId: "din",
          transferTwinId: null,
          accountOnBudget: true,
          accountId: "a1",
        },
        {
          date: "2026-07-01",
          amount: 10000,
          categoryId: "pay",
          transferTwinId: null,
          accountOnBudget: true,
          accountId: "a1",
        },
        {
          date: "2026-07-02",
          amount: -1000,
          categoryId: "groc",
          transferTwinId: "twin",
          accountOnBudget: true,
          accountId: "a1",
        },
        {
          date: "2026-07-03",
          amount: -9000,
          categoryId: "groc",
          transferTwinId: null,
          accountOnBudget: false,
          accountId: "off",
        },
      ],
    });

    assert.equal(result.grandTotalCents, 10000);
    const groc = result.series.find((s) => s.id === "groc");
    assert.ok(groc);
    assert.deepEqual(groc.values, [5000, 3000]);
    assert.equal(groc.totalCents, 8000);
    assert.equal(groc.averageCents, 4000);
    assert.equal(groc.percent, 80);
    const din = result.series.find((s) => s.id === "din");
    assert.ok(din);
    assert.deepEqual(din.values, [2000, 0]);
  });

  it("groups by category group and picks largest category for drill", () => {
    const months = ["2026-08"];
    const result = buildSpendTrendSeries({
      months,
      categories: cats,
      mode: "group",
      txns: [
        {
          date: "2026-08-01",
          amount: -1000,
          categoryId: "din",
          transferTwinId: null,
          accountOnBudget: true,
          accountId: "a1",
        },
        {
          date: "2026-08-02",
          amount: -4000,
          categoryId: "fun",
          transferTwinId: null,
          accountOnBudget: true,
          accountId: "a1",
        },
        {
          date: "2026-08-03",
          amount: -2000,
          categoryId: "groc",
          transferTwinId: null,
          accountOnBudget: true,
          accountId: "a1",
        },
      ],
    });

    const wants = result.series.find((s) => s.id === "wants");
    assert.ok(wants);
    assert.equal(wants.totalCents, 5000);
    assert.equal(wants.drillCategoryId, "fun");
    assert.equal(wants.drillGroupId, "wants");
  });

  it("rolls remainder into Other when over topN", () => {
    const months = ["2026-08"];
    const manyCats = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      name: `Cat ${i}`,
      groupId: `g${i}`,
      groupName: `G${i}`,
      isIncome: false,
    }));
    const result = buildSpendTrendSeries({
      months,
      categories: manyCats,
      mode: "category",
      topN: 2,
      txns: manyCats.map((c, i) => ({
        date: "2026-08-01",
        amount: -(1000 * (5 - i)),
        categoryId: c.id,
        transferTwinId: null,
        accountOnBudget: true,
        accountId: "a1",
      })),
    });

    assert.equal(result.series.length, 3);
    const other = result.series.find((s) => isOtherTrendSeries(s.id));
    assert.ok(other);
    assert.equal(other.name, "Other");
    assert.equal(other.totalCents, 1000 + 2000 + 3000);
  });

  it("scopes to accountId when set", () => {
    const months = ["2026-08"];
    const result = buildSpendTrendSeries({
      months,
      categories: cats,
      mode: "category",
      accountId: "a1",
      txns: [
        {
          date: "2026-08-01",
          amount: -5000,
          categoryId: "groc",
          transferTwinId: null,
          accountOnBudget: true,
          accountId: "a1",
        },
        {
          date: "2026-08-01",
          amount: -9000,
          categoryId: "groc",
          transferTwinId: null,
          accountOnBudget: true,
          accountId: "a2",
        },
      ],
    });
    assert.equal(result.grandTotalCents, 5000);
  });
});
