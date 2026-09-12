import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accountNameLetterSeed,
  uniqueAccountMonograms,
} from "./account-activity-summary";

describe("account monograms", () => {
  it("prefers capitals already in the name", () => {
    assert.equal(accountNameLetterSeed("ING Checking"), "INGC");
    assert.equal(accountNameLetterSeed("Cash"), "C");
  });

  it("falls back to word initials when there are no capitals", () => {
    assert.equal(accountNameLetterSeed("cont curent"), "CC");
    assert.equal(accountNameLetterSeed("linia-de-credit"), "LDC");
  });

  it("assigns unique short labels across accounts", () => {
    const map = uniqueAccountMonograms([
      { id: "1", name: "ING Checking" },
      { id: "2", name: "ING Credit" },
      { id: "3", name: "Cash" },
    ]);
    assert.equal(map["3"], "C");
    assert.notEqual(map["1"], map["2"]);
    assert.ok((map["1"]?.length ?? 0) >= 2);
    assert.ok((map["2"]?.length ?? 0) >= 2);
    const values = Object.values(map);
    assert.equal(new Set(values).size, values.length);
  });
});
