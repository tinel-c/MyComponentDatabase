import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateProposedSplits,
  mapReceiptLines,
} from "./map-lines";

describe("mapReceiptLines", () => {
  const categoriesByName = new Map([
    ["Groceries", { id: "g", name: "Groceries" }],
    ["Clothing", { id: "c", name: "Clothing" }],
    ["Pets", { id: "p", name: "Pets" }],
    ["Household Goods", { id: "h", name: "Household Goods" }],
    ["Unknown", { id: "u", name: "Unknown" }],
  ]);

  const rules = [
    {
      id: "r1",
      matchText: "trening",
      ignore: false,
      categoryId: "c",
      categoryName: "Clothing",
      sortOrder: 0,
    },
    {
      id: "r2",
      matchText: "whiskas",
      ignore: false,
      categoryId: "p",
      categoryName: "Pets",
      sortOrder: 1,
    },
    {
      id: "r3",
      matchText: "reducere lidl",
      ignore: true,
      categoryId: null,
      categoryName: null,
      sortOrder: 2,
    },
  ];

  it("maps clothing and pets over groceries hint", () => {
    const mapped = mapReceiptLines({
      lines: [
        { description: "Trening velur dama", amount: 74.99, categoryHint: "Groceries" },
        { description: "Whiskas Hrana usc", amount: 33.29, categoryHint: "Groceries" },
        { description: "Lapte consum", amount: 5.29, categoryHint: "Groceries" },
        { description: "Reducere Lidl Plus", amount: 1.0 },
      ],
      rules,
      categoriesByName,
      unknownCategoryId: "u",
      unknownCategoryName: "Unknown",
    });
    assert.equal(mapped[0].categoryName, "Clothing");
    assert.equal(mapped[1].categoryName, "Pets");
    assert.equal(mapped[2].categoryName, "Groceries");
    assert.equal(mapped[3].ignored, true);

    const splits = aggregateProposedSplits(mapped, 11357);
    assert.ok(splits.some((s) => s.categoryName === "Clothing"));
    assert.ok(splits.some((s) => s.categoryName === "Pets"));
    const sum = splits.reduce((s, x) => s + x.amountCents, 0);
    assert.equal(sum, 11357);
  });

  it("coerces fuzzy hints and invented names to existing categories", () => {
    const mapped = mapReceiptLines({
      lines: [
        { description: "Detergent", amount: 10, categoryHint: "Household" },
        { description: "Chips", amount: 5, categoryHint: "Snacks" },
        { description: "No hint", amount: 3 },
      ],
      rules: [],
      categoriesByName,
      unknownCategoryId: "u",
      unknownCategoryName: "Unknown",
    });
    assert.equal(mapped[0].categoryName, "Household Goods");
    assert.equal(mapped[1].categoryName, "Groceries");
    assert.equal(mapped[2].categoryName, "Unknown");
    assert.ok(mapped.every((l) => l.ignored || l.categoryId));
  });

  it("falls back to Groceries when Unknown is absent", () => {
    const cats = new Map([
      ["Groceries", { id: "g", name: "Groceries" }],
      ["Clothing", { id: "c", name: "Clothing" }],
    ]);
    const mapped = mapReceiptLines({
      lines: [{ description: "Mystery", amount: 9.99, categoryHint: "Widgets" }],
      rules: [],
      categoriesByName: cats,
      unknownCategoryId: null,
      unknownCategoryName: "Unknown",
    });
    assert.equal(mapped[0].categoryName, "Groceries");
    assert.equal(mapped[0].categoryId, "g");
  });
});
