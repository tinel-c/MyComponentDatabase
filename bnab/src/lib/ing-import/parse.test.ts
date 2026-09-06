import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyRules,
  importFingerprint,
  parseIngAmount,
  parseIngCsv,
  parseIngDate,
  suggestMatchSubstring,
} from "./parse";

const SAMPLE = `Titular cont: DL Test,,,,,,,,,
CNP: 123,,,,,,,,,
,Data,,,Detalii tranzactie,,,Debit,,Credit
01 septembrie 2026,,,Cumparare POS,,,"114,17",,,
,,,Data finalizarii (decontarii): 01-09-2026,,,,,,
,,,Numar card:**** 1234,,,,,,
,,,Tranzactie la:LIDL RO 0207  RO  Eforie Nord,,,,,,
,,,Data autorizarii:30-08-2026,,,,,,
01 septembrie 2026,,,Suma transferata din linia de credit,,,,,"114,17",
,,,Data: 01-09-2026,,,,,,
,,,Din contul:999904927930,,,,,,
02 august 2026,,,Cumparare POS,,,"1.820,88",,,
,,,Terminal:MOL 91426 Constanta 1  RO  Constanta,,,,,,
`;

describe("ING parser", () => {
  it("parses RO dates and amounts", () => {
    assert.equal(parseIngDate("01 septembrie 2026"), "2026-09-01");
    assert.equal(parseIngAmount("1.820,88"), 182088);
    assert.equal(parseIngAmount("114,17"), 11417);
  });

  it("collapses multi-line rows and ignores credit-line when ruled", () => {
    const rows = parseIngCsv(SAMPLE);
    assert.ok(rows.length >= 2);
    const lidl = rows.find((r) => r.memo.includes("LIDL"));
    assert.ok(lidl);
    assert.equal(lidl!.date, "2026-09-01");
    assert.equal(lidl!.amount, -11417);

    const credit = rows.find((r) =>
      r.memo.includes("transferata din linia de credit"),
    );
    assert.ok(credit);
    assert.equal(credit!.amount, 11417);

    const mol = rows.find((r) => r.memo.includes("MOL"));
    assert.ok(mol);
    assert.equal(mol!.amount, -182088);
    assert.ok(mol!.payeeGuess.toUpperCase().includes("MOL"));
  });

  it("applies ignore + category rules and fingerprints", () => {
    const rows = parseIngCsv(SAMPLE);
    const applied = applyRules(
      rows,
      [
        {
          id: "ign",
          matchText: "transferata din linia de credit",
          categoryId: null,
          ignore: true,
          sortOrder: 0,
        },
        {
          id: "groc",
          matchText: "LIDL",
          categoryId: "cat-groc",
          ignore: false,
          sortOrder: 1,
        },
      ],
      "acct1",
      new Map([["cat-groc", "Groceries"]]),
    );
    const ignored = applied.find((r) =>
      r.memo.includes("transferata din linia de credit"),
    );
    assert.equal(ignored!.ignored, true);
    const lidl = applied.find((r) => r.memo.includes("LIDL"));
    assert.equal(lidl!.categoryId, "cat-groc");
    assert.equal(
      lidl!.fingerprint,
      importFingerprint("acct1", lidl!.date, lidl!.amount, lidl!.memo),
    );
  });

  it("suggests substring from merchant", () => {
    const s = suggestMatchSubstring(
      "Cumparare POS Tranzactie la:LIDL RO 0207  RO  Eforie Nord",
    );
    assert.ok(s.toUpperCase().includes("LIDL"));
  });
});
