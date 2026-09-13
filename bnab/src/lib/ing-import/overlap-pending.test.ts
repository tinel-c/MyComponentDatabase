import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPendingBillImportTxn, BILL_IMPORT_PENDING_NOTE } from "./overlap";

describe("isPendingBillImportTxn", () => {
  it("true only when notes match and no fingerprint", () => {
    assert.equal(
      isPendingBillImportTxn({
        notes: BILL_IMPORT_PENDING_NOTE,
        importFingerprint: null,
      }),
      true,
    );
    assert.equal(
      isPendingBillImportTxn({
        notes: BILL_IMPORT_PENDING_NOTE,
        importFingerprint: "fp",
      }),
      false,
    );
    assert.equal(
      isPendingBillImportTxn({
        notes: "Groceries",
        importFingerprint: null,
      }),
      false,
    );
  });
});
