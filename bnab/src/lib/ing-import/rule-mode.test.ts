import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveImportRuleMode } from "./rule-mode";

describe("resolveImportRuleMode", () => {
  it("treats empty category + transfer as transfer-only", () => {
    assert.equal(
      resolveImportRuleMode({
        ignore: false,
        categoryId: "",
        transferAccountId: "sav",
      }),
      "transfer",
    );
    assert.equal(
      resolveImportRuleMode({
        ignore: false,
        categoryId: null,
        transferAccountId: "sav",
      }),
      "transfer",
    );
  });

  it("treats income category + transfer as hybrid", () => {
    assert.equal(
      resolveImportRuleMode({
        ignore: false,
        categoryId: "paycheck",
        transferAccountId: "sav",
      }),
      "category_transfer",
    );
  });

  it("treats category alone as category", () => {
    assert.equal(
      resolveImportRuleMode({
        ignore: false,
        categoryId: "paycheck",
        transferAccountId: "",
      }),
      "category",
    );
  });

  it("returns null when nothing selected", () => {
    assert.equal(
      resolveImportRuleMode({
        ignore: false,
        categoryId: "",
        transferAccountId: "",
      }),
      null,
    );
    assert.equal(
      resolveImportRuleMode({
        ignore: false,
        categoryId: null,
        transferAccountId: null,
      }),
      null,
    );
  });

  it("ignore wins over other fields", () => {
    assert.equal(
      resolveImportRuleMode({
        ignore: true,
        categoryId: "paycheck",
        transferAccountId: "sav",
      }),
      "ignore",
    );
  });
});
