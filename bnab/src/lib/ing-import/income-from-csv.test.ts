import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeBudgetMonths } from "../budget-engine/index";
import {
  incomeForMonth,
  monthlyIncomeFromAppliedRows,
  monthlySpendFromAppliedRows,
} from "./income-from-csv";
import { applyRules, parseIngCsv } from "./parse";

/**
 * Compact HomeBank CSV with known Paycheck / Other income across months.
 * Expected Plan Paycheck activity:
 *   2026-10: 21.000,00 + 1.000,00 (hybrid savings) = 22.000,00
 *   2026-11: 22.246,00
 * Credit-line cover is ignored (not income).
 */
const FIXTURE = `Titular cont: DL Test,,,,,,,
CNP: 123,,,,,,,
Data,,,Detalii tranzactie,Debit,,Credit,Balanta
05 noiembrie 2026,,,Incasare,,,"22.246,00","1.000,00"
,,,Data: 05-11-2026,,,,
,,,Ordonator:SCHAEFFLER MOTION TECHNOLOGIES,,,,
,,,Din contul:RO51INGB0002008200238921,,,,
,,,Detalii:Salariu octombrie,,,,
05 octombrie 2026,,,Incasare,,,"21.000,00","500,00"
,,,Data: 05-10-2026,,,,
,,,Ordonator:SCHAEFFLER MOTION TECHNOLOGIES,,,,
,,,Din contul:RO51INGB0002008200238921,,,,
,,,Detalii:Salariu septembrie,,,,
12 octombrie 2026,,,Incasare,,,"1.000,00","1.500,00"
,,,Data: 12-10-2026,,,,
,,,Ordonator:Constantin Bogza,,,,
,,,Din contul:RO18INGB0000999904165476,,,,
01 septembrie 2026,,,Cumparare POS,"114,17",,,"386,00"
,,,Tranzactie la:LIDL RO 0207  RO  Eforie Nord,,,,
01 septembrie 2026,,,Suma transferata din linia de credit,,,"114,17","500,17"
,,,Data: 01-09-2026,,,,
,,,Din contul:999904927930,,,,
`;

const PAYCHECK = "cat-paycheck";
const OTHER = "cat-other";
const GROCERIES = "cat-groc";
const INCOME_IDS = new Set([PAYCHECK, OTHER]);
const SPEND_IDS = new Set([GROCERIES]);

const RULES = [
  {
    id: "ignore-credit-line",
    matchText: "transferata din linia de credit",
    categoryId: null,
    ignore: true,
    sortOrder: 0,
  },
  {
    id: "hybrid-savings",
    matchText: "Din contul:RO18INGB0000999904165476",
    categoryId: PAYCHECK,
    transferAccountId: "savings",
    ignore: false,
    sortOrder: 1,
  },
  {
    id: "salariu",
    matchText: "Detalii:Salariu",
    categoryId: PAYCHECK,
    ignore: false,
    sortOrder: 2,
  },
  {
    id: "other-credit-iban",
    matchText: "Din contul:999904927930",
    categoryId: OTHER,
    ignore: false,
    sortOrder: 3,
  },
  {
    id: "lidl",
    matchText: "LIDL",
    categoryId: GROCERIES,
    ignore: false,
    sortOrder: 4,
  },
];

const NAME_BY_ID = new Map([
  [PAYCHECK, "Paycheck"],
  [OTHER, "Other income"],
  [GROCERIES, "Groceries"],
]);

describe("CSV monthly income vs Plan display", () => {
  it("aggregates Paycheck by month from the import file", () => {
    const rows = parseIngCsv(FIXTURE);
    const applied = applyRules(rows, RULES, "checking", NAME_BY_ID);
    const buckets = monthlyIncomeFromAppliedRows(applied, INCOME_IDS);

    const oct = incomeForMonth(buckets, "2026-10");
    assert.equal(oct.byCategoryId[PAYCHECK], 2_200_000); // 21000 + 1000
    assert.equal(oct.total, 2_200_000);

    const nov = incomeForMonth(buckets, "2026-11");
    assert.equal(nov.byCategoryId[PAYCHECK], 2_224_600);
    assert.equal(nov.total, 2_224_600);

    // Credit-line ignored → September has no income from this file
    const sep = incomeForMonth(buckets, "2026-09");
    assert.equal(sep.total, 0);
  });

  it("ignore rule beats Other income IBAN for credit-line covers", () => {
    const rows = parseIngCsv(FIXTURE);
    const applied = applyRules(rows, RULES, "checking", NAME_BY_ID);
    const creditLine = applied.find((r) =>
      r.memo.includes("transferata din linia de credit"),
    );
    assert.ok(creditLine);
    assert.equal(creditLine!.ignored, true);
    assert.equal(creditLine!.categoryId, null);

    // Without ignore, the IBAN rule would wrongly classify as Other income
    const broken = applyRules(
      rows,
      RULES.filter((r) => r.id !== "ignore-credit-line"),
      "checking",
      NAME_BY_ID,
    );
    const wrongly = broken.find((r) =>
      r.memo.includes("transferata din linia de credit"),
    );
    assert.ok(wrongly);
    assert.equal(wrongly!.categoryId, OTHER);
  });

  it("matches Plan category activity for each month", () => {
    const rows = parseIngCsv(FIXTURE);
    const applied = applyRules(rows, RULES, "checking", NAME_BY_ID);
    const buckets = monthlyIncomeFromAppliedRows(applied, INCOME_IDS);

    const checking = {
      id: "checking",
      onBudget: true,
      type: "CHECKING",
      creditCategoryId: null,
    };
    const savings = {
      id: "savings",
      onBudget: true,
      type: "SAVINGS",
      creditCategoryId: null,
    };
    const paycheck = {
      id: PAYCHECK,
      isIncome: true,
      isSystem: false,
      systemKey: null,
    };
    const other = {
      id: OTHER,
      isIncome: true,
      isSystem: false,
      systemKey: null,
    };

    // Statement legs only (hybrid twin not needed for income activity on Paycheck)
    const txns = applied
      .filter((r) => !r.ignored && r.categoryId && INCOME_IDS.has(r.categoryId))
      .map((r, i) => ({
        id: `tx-${i}`,
        accountId: "checking",
        date: r.date,
        amount: r.amount,
        categoryId: r.categoryId,
        isParent: false,
        isChild: false,
        transferTwinId: r.transferAccountId ? `twin-${i}` : null,
        isStartingBalance: false,
      }));

    const months = computeBudgetMonths({
      firstMonth: "2026-09",
      endMonth: "2026-11",
      accounts: [checking, savings],
      categories: [paycheck, other],
      transactions: txns,
      assigned: [],
    });

    for (const bucket of buckets) {
      const plan = months.find((m) => m.month === bucket.month);
      assert.ok(plan, `Plan month ${bucket.month}`);
      for (const [catId, csvAmount] of Object.entries(bucket.byCategoryId)) {
        const displayed = plan!.categories[catId]?.activity ?? 0;
        assert.equal(
          displayed,
          csvAmount,
          `${bucket.month} ${catId}: CSV ${csvAmount} vs Plan ${displayed}`,
        );
      }
    }

    // Explicit month checks (what the Plan Income section shows)
    const planOct = months.find((m) => m.month === "2026-10")!;
    assert.equal(planOct.categories[PAYCHECK].activity, 2_200_000);
    const planNov = months.find((m) => m.month === "2026-11")!;
    assert.equal(planNov.categories[PAYCHECK].activity, 2_224_600);
    const planSep = months.find((m) => m.month === "2026-09")!;
    assert.equal(planSep.categories[PAYCHECK]?.activity ?? 0, 0);
  });

  it("aggregates Spent magnitude from spending categories", () => {
    const rows = parseIngCsv(FIXTURE);
    const applied = applyRules(rows, RULES, "checking", NAME_BY_ID);
    const spend = monthlySpendFromAppliedRows(applied, SPEND_IDS);
    const sep = spend.find((b) => b.month === "2026-09");
    assert.ok(sep);
    assert.equal(sep!.byCategoryId[GROCERIES], -11_417);
    assert.equal(sep!.spentMagnitude, 11_417);
  });
});
