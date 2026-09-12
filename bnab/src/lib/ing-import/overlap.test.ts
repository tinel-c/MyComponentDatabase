import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyRules,
  findManualMatch,
  importFingerprint,
  parseIngCsv,
} from "./parse";
import {
  BILL_IMPORT_PENDING_NOTE,
  applyNewRuleToPreviewRows,
  classifyIngImportPreview,
  classifyIngRowAgainstLedger,
  isBillImportPendingNotes,
  planIngConfirmAction,
  type ManualLedgerTxn,
} from "./overlap";

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

function lidlApplied(accountId = "acct1") {
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
      {
        id: "fuel",
        matchText: "MOL",
        categoryId: "cat-fuel",
        ignore: false,
        sortOrder: 2,
      },
    ],
    accountId,
    new Map([
      ["cat-groc", "Groceries"],
      ["cat-fuel", "Fuel"],
    ]),
  );
  const lidl = applied.find((r) => r.memo.includes("LIDL"));
  assert.ok(lidl, "expected LIDL row");
  return { applied, lidl };
}

describe("findManualMatch — bill ↔ ING overlap", () => {
  const bill: ManualLedgerTxn = {
    id: "bill-lidl",
    date: "2026-09-01",
    amount: -11417,
    notes: BILL_IMPORT_PENDING_NOTE,
    payeeName: "LIDL RO 0207",
  };

  it("links a pending bill import to the matching ING debit", () => {
    const { lidl } = lidlApplied();
    const id = findManualMatch(lidl, [bill]);
    assert.equal(id, "bill-lidl");
  });

  it("tolerates ±2 minor units on amount", () => {
    const id = findManualMatch(
      { date: "2026-09-01", amount: -11417, memo: "Tranzactie la:LIDL" },
      [{ ...bill, amount: -11419 }],
    );
    assert.equal(id, "bill-lidl");
  });

  it("rejects amount outside ±2¢", () => {
    const id = findManualMatch(
      { date: "2026-09-01", amount: -11417, memo: "LIDL" },
      [{ ...bill, amount: -11420 }],
    );
    assert.equal(id, null);
  });

  it("tolerates date within ±3 days", () => {
    const id = findManualMatch(
      { date: "2026-09-01", amount: -11417, memo: "LIDL" },
      [{ ...bill, date: "2026-08-29" }],
    );
    assert.equal(id, "bill-lidl");
  });

  it("rejects date outside ±3 days", () => {
    const id = findManualMatch(
      { date: "2026-09-01", amount: -11417, memo: "LIDL" },
      [{ ...bill, date: "2026-08-28" }],
    );
    assert.equal(id, null);
  });

  it("prefers bill-import notes + payee hit over a bare amount twin", () => {
    const bare: ManualLedgerTxn = {
      id: "bare",
      date: "2026-09-01",
      amount: -11417,
      notes: null,
      payeeName: null,
    };
    const id = findManualMatch(
      {
        date: "2026-09-01",
        amount: -11417,
        memo: "Cumparare POS Tranzactie la:LIDL RO 0207",
      },
      [bare, bill],
    );
    assert.equal(id, "bill-lidl");
  });

  it("returns null when two manuals are too close to auto-pick", () => {
    const twin: ManualLedgerTxn = {
      id: "bill-twin",
      date: "2026-09-01",
      amount: -11417,
      notes: BILL_IMPORT_PENDING_NOTE,
      payeeName: "LIDL RO 0207",
    };
    const id = findManualMatch(
      {
        date: "2026-09-01",
        amount: -11417,
        memo: "Cumparare POS Tranzactie la:LIDL RO 0207",
      },
      [bill, twin],
    );
    assert.equal(id, null);
  });

  it("does not crash on empty manuals, null notes, or empty memo", () => {
    assert.equal(
      findManualMatch({ date: "2026-09-01", amount: -1 }, []),
      null,
    );
    assert.equal(
      findManualMatch(
        { date: "2026-09-01", amount: -11417, memo: "" },
        [{ ...bill, notes: null, payeeName: null }],
      ),
      "bill-lidl",
    );
  });
});

describe("classifyIngRowAgainstLedger — no duplicate spend", () => {
  it("marks fingerprint already on account as already_imported (never a second create)", () => {
    const { lidl } = lidlApplied();
    const c = classifyIngRowAgainstLedger(
      lidl,
      new Set([lidl.fingerprint]),
      [
        {
          id: "bill-lidl",
          date: lidl.date,
          amount: lidl.amount,
          notes: BILL_IMPORT_PENDING_NOTE,
          payeeName: "LIDL",
        },
      ],
    );
    assert.equal(c.status, "already_imported");
    assert.equal(c.manualMatchId, null);
  });

  it("flags pending bill as possible_manual_match instead of new", () => {
    const { lidl } = lidlApplied();
    const c = classifyIngRowAgainstLedger(lidl, new Set(), [
      {
        id: "bill-lidl",
        date: lidl.date,
        amount: lidl.amount,
        notes: BILL_IMPORT_PENDING_NOTE,
        payeeName: "LIDL RO 0207",
      },
    ]);
    assert.equal(c.status, "possible_manual_match");
    assert.equal(c.manualMatchId, "bill-lidl");
  });

  it("keeps ignored credit-line rows ignored when only an opposite-sign bill matches", () => {
    const { applied } = lidlApplied();
    const credit = applied.find((r) =>
      r.memo.includes("transferata din linia de credit"),
    );
    assert.ok(credit);
    const c = classifyIngRowAgainstLedger(credit!, new Set(), [
      {
        id: "bill-lidl",
        date: "2026-09-01",
        amount: -11417,
        notes: BILL_IMPORT_PENDING_NOTE,
        payeeName: "LIDL",
      },
    ]);
    assert.equal(c.status, "ignored");
  });

  it("links ignored ING debit to a pending bill when amount matches", () => {
    const debit: Parameters<typeof classifyIngRowAgainstLedger>[0] = {
      fingerprint: "fp-ign",
      date: "2026-09-01",
      amount: -5000,
      memo: "Something transferata din linia de credit extra",
      categoryId: null,
      ignored: true,
    };
    const c = classifyIngRowAgainstLedger(debit, new Set(), [
      {
        id: "bill-x",
        date: "2026-09-01",
        amount: -5000,
        notes: BILL_IMPORT_PENDING_NOTE,
        payeeName: "Something",
      },
    ]);
    assert.equal(c.status, "possible_manual_match");
    assert.equal(c.manualMatchId, "bill-x");
  });
});

describe("planIngConfirmAction — apply path safety", () => {
  it("never creates when fingerprint already exists", () => {
    const plan = planIngConfirmAction({
      ignored: false,
      fingerprint: "fp1",
      fingerprintAlreadyOnAccount: true,
      decision: { fingerprint: "fp1", action: "import" },
    });
    assert.equal(plan.kind, "skip_duplicate");
  });

  it("links to the bill entry instead of creating a twin", () => {
    const plan = planIngConfirmAction({
      ignored: false,
      fingerprint: "fp1",
      fingerprintAlreadyOnAccount: false,
      decision: {
        fingerprint: "fp1",
        action: "link",
        manualMatchId: "bill-lidl",
      },
    });
    assert.deepEqual(plan, { kind: "link", manualMatchId: "bill-lidl" });
  });

  it("skips link with missing manualMatchId (avoids silent duplicate create)", () => {
    const plan = planIngConfirmAction({
      ignored: false,
      fingerprint: "fp1",
      fingerprintAlreadyOnAccount: false,
      decision: { fingerprint: "fp1", action: "link", manualMatchId: null },
    });
    assert.equal(plan.kind, "skip_user");
  });

  it("creates ignored rows into the ledger (budget exclude is post-import)", () => {
    const plan = planIngConfirmAction({
      ignored: true,
      fingerprint: "fp-ign",
      fingerprintAlreadyOnAccount: false,
      decision: { fingerprint: "fp-ign", action: "import" },
    });
    assert.equal(plan.kind, "create");
  });

  it("links ignored rows when the user chose link", () => {
    const plan = planIngConfirmAction({
      ignored: true,
      fingerprint: "fp-ign",
      fingerprintAlreadyOnAccount: false,
      decision: {
        fingerprint: "fp-ign",
        action: "link",
        manualMatchId: "bill-x",
      },
    });
    assert.deepEqual(plan, { kind: "link", manualMatchId: "bill-x" });
  });
});

describe("bill then ING then re-import regression", () => {
  it("bill-first preview proposes link; after link, re-import is all already/ignored", () => {
    const { applied, lidl } = lidlApplied();

    // 1) Bill exists (unfingerprinted) → LIDL is a manual match, not "new"
    const beforeLink = classifyIngImportPreview({
      rows: applied,
      existingFingerprints: new Set(),
      manuals: [
        {
          id: "bill-lidl",
          date: lidl.date,
          amount: lidl.amount,
          notes: `${BILL_IMPORT_PENDING_NOTE} — milk; bread`,
          payeeName: "LIDL RO 0207",
        },
      ],
    });
    assert.equal(beforeLink.stats.manual, 1);
    assert.ok(!beforeLink.wouldCreateFingerprints.includes(lidl.fingerprint));
    const lidlPreview = beforeLink.rows.find((r) => r.fingerprint === lidl.fingerprint);
    assert.equal(lidlPreview?.status, "possible_manual_match");
    assert.equal(lidlPreview?.manualMatchId, "bill-lidl");

    // 2) User links → fingerprint now on account
    const linkPlan = planIngConfirmAction({
      ignored: false,
      fingerprint: lidl.fingerprint,
      fingerprintAlreadyOnAccount: false,
      decision: {
        fingerprint: lidl.fingerprint,
        action: "link",
        manualMatchId: "bill-lidl",
      },
    });
    assert.equal(linkPlan.kind, "link");

    // 3) Same CSV again → already_imported LIDL; ignored credit + MOL would create
    const afterLink = classifyIngImportPreview({
      rows: applied,
      existingFingerprints: new Set([lidl.fingerprint]),
      manuals: [], // linked row now has fingerprint, no longer in manuals
    });
    assert.equal(afterLink.stats.already, 1);
    assert.equal(afterLink.stats.ignored, 1);
    assert.equal(afterLink.wouldCreateFingerprints.length, 2); // MOL + ignored credit
    assert.ok(!afterLink.wouldCreateFingerprints.includes(lidl.fingerprint));

    // 4) Re-confirm LIDL is skip_duplicate even if UI says import
    const reconfirm = planIngConfirmAction({
      ignored: false,
      fingerprint: lidl.fingerprint,
      fingerprintAlreadyOnAccount: true,
      decision: { fingerprint: lidl.fingerprint, action: "import" },
    });
    assert.equal(reconfirm.kind, "skip_duplicate");
  });

  it("stable fingerprints across parses (idempotent identity)", () => {
    const a = lidlApplied().lidl.fingerprint;
    const b = lidlApplied().lidl.fingerprint;
    assert.equal(a, b);
    assert.equal(
      a,
      importFingerprint("acct1", "2026-09-01", -11417, lidlApplied().lidl.memo),
    );
  });

  it("isBillImportPendingNotes recognizes stamped notes", () => {
    assert.equal(isBillImportPendingNotes(BILL_IMPORT_PENDING_NOTE), true);
    assert.equal(
      isBillImportPendingNotes("Bill import · pending statement — eggs"),
      true,
    );
    assert.equal(isBillImportPendingNotes("Regular memo"), false);
    assert.equal(isBillImportPendingNotes(null), false);
  });
});

describe("applyNewRuleToPreviewRows", () => {
  it("clears all unmatched rows whose memo contains the substring anywhere", () => {
    const rows = [
      {
        fingerprint: "a",
        memo: "xxx MERCHANT yyy",
        status: "unmatched" as const,
        ignored: false,
        categoryId: null,
        categoryName: null,
      },
      {
        fingerprint: "b",
        memo: "other",
        status: "unmatched" as const,
        ignored: false,
        categoryId: null,
        categoryName: null,
      },
      {
        fingerprint: "c",
        memo: "prefix MERCHANT",
        status: "unmatched" as const,
        ignored: false,
        categoryId: null,
        categoryName: null,
      },
    ];
    const out = applyNewRuleToPreviewRows(rows, {
      matchText: "merchant",
      ignore: false,
      categoryId: "cat1",
      categoryName: "Groceries: Food",
    });
    assert.equal(out.stats.unmatched, 1);
    assert.equal(out.stats.new, 2);
    assert.deepEqual(out.matchedFingerprints.sort(), ["a", "c"]);
    assert.equal(out.rows[0].status, "new");
    assert.equal(out.rows[0].categoryId, "cat1");
    assert.equal(out.rows[1].status, "unmatched");
  });
});
