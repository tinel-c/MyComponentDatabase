import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_ERASE_FLAGS,
  freshLedgerEraseFlags,
  parseEraseFlags,
} from "./selective-erase";

describe("selective erase flags", () => {
  it("defaults keep import and receipt mappings", () => {
    const d = freshLedgerEraseFlags();
    assert.equal(d.importRules, false);
    assert.equal(d.receiptRules, false);
    assert.equal(d.categories, false);
    assert.equal(d.accounts, false);
    assert.equal(d.transactions, true);
    assert.equal(d.importBatches, true);
    assert.equal(d.receiptScans, true);
  });

  it("parseEraseFlags treats missing checkboxes as off", () => {
    const map = new Map<string, string>([
      ["transactions", "on"],
      ["importRules", "on"],
    ]);
    const flags = parseEraseFlags((name) => map.get(name) ?? null);
    assert.equal(flags.transactions, true);
    assert.equal(flags.importRules, true);
    assert.equal(flags.receiptRules, false);
    assert.equal(flags.importBatches, false);
    assert.equal(flags.payees, false);
  });

  it("DEFAULT_ERASE_FLAGS matches fresh-ledger defaults", () => {
    assert.deepEqual(DEFAULT_ERASE_FLAGS, freshLedgerEraseFlags());
  });
});
