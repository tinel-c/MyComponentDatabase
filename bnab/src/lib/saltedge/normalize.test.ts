import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  saltEdgeTxnToParsedRow,
  normalizeSaltEdgeTransactions,
  applyRulesToSaltEdgeRows,
} from "./normalize";
import { suggestImportRuleFromEnrichment } from "./enrichment";
import { assertPisAllowed, isPisEnabled, PisNotEnabledError } from "./pis-gate";
import { signSaltEdgeRequest } from "./client";
import { generateKeyPairSync } from "node:crypto";
import { isMandatoryFakeProvider, SALTEDGE_MANDATORY_FAKE_CODES } from "./providers-ro";

describe("saltEdgeTxnToParsedRow", () => {
  it("maps outflow to negative minor units", () => {
    const row = saltEdgeTxnToParsedRow({
      id: "tx-1",
      account_id: "acc-1",
      made_on: "2026-09-01",
      amount: -12.34,
      description: "LIDL BUCHAREST",
      status: "posted",
    });
    assert.ok(row);
    assert.equal(row!.amount, -1234);
    assert.equal(row!.outflowMinor, 1234);
    assert.equal(row!.inflowMinor, 0);
    assert.equal(row!.providerTransactionId, "tx-1");
    assert.equal(row!.pending, false);
  });

  it("marks pending status", () => {
    const row = saltEdgeTxnToParsedRow({
      id: "tx-2",
      account_id: "acc-1",
      made_on: "2026-09-02",
      amount: 100,
      description: "Salary",
      status: "pending",
    });
    assert.equal(row!.pending, true);
    assert.equal(row!.amount, 10000);
  });

  it("rejects bad dates", () => {
    assert.equal(
      saltEdgeTxnToParsedRow({
        id: "x",
        account_id: "a",
        made_on: "01/09/2026",
        amount: 1,
      }),
      null,
    );
  });
});

describe("applyRulesToSaltEdgeRows", () => {
  it("applies import rules and fingerprints like CSV path", () => {
    const normalized = normalizeSaltEdgeTransactions([
      {
        id: "se-1",
        account_id: "ext",
        made_on: "2026-09-03",
        amount: -50,
        description: "LIDL store 12",
      },
    ]);
    const applied = applyRulesToSaltEdgeRows(
      normalized,
      [
        {
          id: "rule-1",
          matchText: "LIDL",
          categoryId: "cat-groc",
          ignore: false,
          sortOrder: 0,
        },
      ],
      "acct-bnab",
      new Map([["cat-groc", "Groceries"]]),
    );
    assert.equal(applied.length, 1);
    assert.equal(applied[0]!.categoryId, "cat-groc");
    assert.equal(applied[0]!.providerTransactionId, "se-1");
    assert.ok(applied[0]!.fingerprint.length > 10);
  });
});

describe("enrichment suggestions", () => {
  it("prefers merchant_id", () => {
    const s = suggestImportRuleFromEnrichment({
      description: "POS 1234",
      extra: { merchant_id: "LIDL RO" },
    });
    assert.equal(s?.matchText, "LIDL RO");
    assert.equal(s?.source, "merchant_id");
  });
});

describe("pis gate", () => {
  it("is disabled by default", () => {
    const prev = process.env.SALTEDGE_PIS_ENABLED;
    delete process.env.SALTEDGE_PIS_ENABLED;
    assert.equal(isPisEnabled(), false);
    assert.throws(() => assertPisAllowed(), PisNotEnabledError);
    if (prev !== undefined) process.env.SALTEDGE_PIS_ENABLED = prev;
  });
});

describe("providers-ro", () => {
  it("lists mandatory fake codes for LIVE checklist", () => {
    assert.ok(isMandatoryFakeProvider(SALTEDGE_MANDATORY_FAKE_CODES[0]));
  });
});

describe("signSaltEdgeRequest", () => {
  it("produces base64 RSA-SHA256 signature", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pem = privateKey.export({ type: "pkcs1", format: "pem" }).toString();
    const sig = signSaltEdgeRequest({
      privateKeyPem: pem,
      expiresAt: 1700000000,
      method: "GET",
      url: "https://www.saltedge.com/api/partners/v1/connections/1",
      body: "",
    });
    assert.match(sig, /^[A-Za-z0-9+/=]+$/);
    assert.ok(sig.length > 100);
  });
});
