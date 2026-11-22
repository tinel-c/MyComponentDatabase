import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assignedMatchingActivity } from "./assign-to-activity";

describe("assignedMatchingActivity", () => {
  it("funds outflow activity exactly", () => {
    assert.equal(assignedMatchingActivity(-1_868_580), 1_868_580);
    assert.equal(assignedMatchingActivity(-1), 1);
  });

  it("zeros assigned when activity is zero or positive", () => {
    assert.equal(assignedMatchingActivity(0), 0);
    assert.equal(assignedMatchingActivity(500), 0);
  });
});
