import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findUniquePlannedMatch,
  plannedCashDueInMonth,
  plannedMonthlyAssign,
  plannedMonthTotal,
  weekdayOccurrencesInMonth,
} from "./planned-payments";

describe("findUniquePlannedMatch", () => {
  const candidates = [
    {
      id: "a",
      accountId: "acc1",
      amount: -5000,
      nextDate: "2026-09-10",
      active: true,
    },
    {
      id: "b",
      accountId: "acc1",
      amount: -3000,
      nextDate: "2026-09-15",
      active: true,
    },
  ];

  it("matches unique amount and date window", () => {
    assert.equal(
      findUniquePlannedMatch(
        { accountId: "acc1", amount: -5001, date: "2026-09-12" },
        candidates,
      ),
      "a",
    );
  });

  it("returns null when ambiguous", () => {
    const dup = [
      ...candidates,
      {
        id: "c",
        accountId: "acc1",
        amount: -5000,
        nextDate: "2026-09-11",
        active: true,
      },
    ];
    assert.equal(
      findUniquePlannedMatch(
        { accountId: "acc1", amount: -5000, date: "2026-09-10" },
        dup,
      ),
      null,
    );
  });
});

describe("plannedCashDueInMonth", () => {
  it("monthly returns amount", () => {
    assert.equal(
      plannedCashDueInMonth({
        amount: -1000,
        recurrence: "MONTHLY",
        nextDate: "2026-09-01",
        month: "2026-09",
      }),
      -1000,
    );
  });

  it("weekly multiplies by weekday count", () => {
    const wed = 3;
    assert.equal(weekdayOccurrencesInMonth("2026-09", wed), 5);
    assert.equal(
      plannedCashDueInMonth({
        amount: -100,
        recurrence: "WEEKLY",
        nextDate: "2026-09-02",
        month: "2026-09",
        weekday: wed,
      }),
      -500,
    );
  });

  it("yearly full amount only in due month", () => {
    assert.equal(
      plannedCashDueInMonth({
        amount: -1_200_000,
        recurrence: "YEARLY",
        nextDate: "2026-09-15",
        month: "2026-09",
      }),
      -1_200_000,
    );
    assert.equal(
      plannedCashDueInMonth({
        amount: -1_200_000,
        recurrence: "YEARLY",
        nextDate: "2026-09-15",
        month: "2026-03",
      }),
      0,
    );
  });
});

describe("plannedMonthlyAssign", () => {
  it("yearly spreads as round(amount/12) every month", () => {
    assert.equal(
      plannedMonthlyAssign({
        amount: -1_200_000,
        recurrence: "YEARLY",
        nextDate: "2026-09-15",
        month: "2026-03",
      }),
      -100_000,
    );
    assert.equal(
      plannedMonthlyAssign({
        amount: -1_200_000,
        recurrence: "YEARLY",
        nextDate: "2026-09-15",
        month: "2026-09",
      }),
      -100_000,
    );
  });

  it("monthly equals cash due", () => {
    assert.equal(
      plannedMonthlyAssign({
        amount: -5000,
        recurrence: "MONTHLY",
        nextDate: "2026-09-01",
        month: "2026-09",
      }),
      -5000,
    );
  });
});

describe("plannedMonthTotal alias", () => {
  it("matches plannedCashDueInMonth", () => {
    const params = {
      amount: -1_200_000,
      recurrence: "YEARLY" as const,
      nextDate: "2026-09-15",
      month: "2026-09",
    };
    assert.equal(plannedMonthTotal(params), plannedCashDueInMonth(params));
  });
});
