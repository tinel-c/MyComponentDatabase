import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findUniquePlannedMatch,
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

describe("plannedMonthTotal", () => {
  it("monthly returns amount", () => {
    assert.equal(
      plannedMonthTotal({
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
      plannedMonthTotal({
        amount: -100,
        recurrence: "WEEKLY",
        nextDate: "2026-09-02",
        month: "2026-09",
        weekday: wed,
      }),
      -500,
    );
  });
});
