import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { estimatePayoffMonths } from "./loan-payoff";

describe("estimatePayoffMonths", () => {
  it("handles zero interest", () => {
    const r = estimatePayoffMonths({
      balance: 1200,
      aprPercent: 0,
      payment: 100,
    });
    assert.equal(r.never, false);
    assert.equal(r.months, 12);
    assert.equal(r.totalInterest, 0);
  });

  it("detects never-pays when payment ≤ interest", () => {
    const r = estimatePayoffMonths({
      balance: 10000,
      aprPercent: 24,
      payment: 100,
    });
    assert.equal(r.never, true);
    assert.equal(r.months, null);
  });

  it("estimates months with interest", () => {
    const r = estimatePayoffMonths({
      balance: 10000,
      aprPercent: 6,
      payment: 200,
    });
    assert.equal(r.never, false);
    assert.ok(r.months != null && r.months > 50 && r.months < 60);
    assert.ok(r.totalInterest != null && r.totalInterest > 0);
  });
});
