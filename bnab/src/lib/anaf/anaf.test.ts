import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { extractCuiFromMemo, normalizeCui } from "./cui";
import { categoryNameForCaen } from "./caen-map";
import { clearAnafCache, lookupTaxpayers } from "./client";
import { buildImportProposals } from "./proposals";

describe("extractCuiFromMemo", () => {
  it("parses CUI: label", () => {
    assert.equal(extractCuiFromMemo("Plata factura CUI: 13548146 rest"), "13548146");
  });
  it("parses RO + digits", () => {
    assert.equal(extractCuiFromMemo("Beneficiar RO 12345678 detalii"), "12345678");
  });
  it("returns null without CUI", () => {
    assert.equal(
      extractCuiFromMemo("Cumparare POS Tranzactie la:LIDL RO 0207  RO  Eforie Nord"),
      null,
    );
  });
  it("normalizeCui strips non-digits", () => {
    assert.equal(normalizeCui("RO-001234"), "1234");
  });
});

describe("categoryNameForCaen", () => {
  it("maps restaurants 5610 → Office food", () => {
    assert.equal(categoryNameForCaen("5610"), "Office food");
  });
  it("maps pharmacies 4773 → Medical", () => {
    assert.equal(categoryNameForCaen("4773"), "Medical");
  });
  it("maps fuel 4730 → Fuel", () => {
    assert.equal(categoryNameForCaen("4730"), "Fuel");
  });
  it("maps division 86 → Medical", () => {
    assert.equal(categoryNameForCaen("86"), "Medical");
  });
});

describe("lookupTaxpayers", () => {
  beforeEach(() => clearAnafCache());

  it("uses mocked fetch and caches", async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return new Response(
        JSON.stringify({
          found: [
            {
              date_generale: {
                cui: 13548146,
                denumire: "TEST SRL",
                cod_CAEN: "5610",
              },
            },
          ],
          notFound: [],
        }),
        { status: 200 },
      );
    };
    const a = await lookupTaxpayers(["13548146"], {
      date: "2026-11-22",
      fetchImpl,
      skipThrottle: true,
    });
    assert.equal(a.get("13548146")?.date_generale?.denumire, "TEST SRL");
    const b = await lookupTaxpayers(["13548146"], {
      date: "2026-11-22",
      fetchImpl,
      skipThrottle: true,
    });
    assert.equal(b.get("13548146")?.date_generale?.cod_CAEN, "5610");
    assert.equal(calls, 1);
  });
});

describe("buildImportProposals", () => {
  beforeEach(() => clearAnafCache());

  it("ANAF path when CUI present", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          found: [
            {
              date_generale: {
                cui: 99999999,
                denumire: "GASTRO PARK SRL",
                cod_CAEN: "5610",
              },
            },
          ],
          notFound: [],
        }),
        { status: 200 },
      );

    const cats = [{ id: "cat-food", name: "Office food" }];
    const map = await buildImportProposals({
      rows: [
        {
          fingerprint: "fp1",
          memo: "Plata CUI: 99999999 Gastro",
          date: "2026-11-20",
        },
      ],
      categories: cats,
      fetchImpl,
      skipThrottle: true,
    });
    const p = map.get("fp1");
    assert.ok(p);
    assert.equal(p!.source, "anaf");
    assert.equal(p!.categoryId, "cat-food");
    assert.equal(p!.caen, "5610");
  });

  it("heuristic when no CUI", async () => {
    const map = await buildImportProposals({
      rows: [
        {
          fingerprint: "fp2",
          memo: "Cumparare POS Tranzactie la:LIDL RO 0207",
          date: "2026-11-20",
        },
      ],
      categories: [{ id: "g", name: "Groceries" }],
      skipThrottle: true,
    });
    const p = map.get("fp2");
    assert.ok(p);
    assert.equal(p!.source, "heuristic");
    assert.ok(p!.matchText.toLowerCase().includes("lidl"));
  });
});
