"use client";

import { useState, useTransition } from "react";
import {
  buttonCompactClass,
  buttonCompactDangerClass,
  cardCompactClass,
  inputClass,
  labelClass,
  pageStackClass,
} from "@/components/forms/field-classes";
import { DEFAULT_ERASE_FLAGS } from "@/lib/data-tools/selective-erase";
import {
  importDatabaseAction,
  selectiveEraseAction,
  type DataToolsResult,
} from "@/app/(app)/more/data/actions";

const ERASE_OPTIONS: {
  key: keyof typeof DEFAULT_ERASE_FLAGS;
  label: string;
  hint: string;
}[] = [
  {
    key: "transactions",
    label: "Transactions",
    hint: "All ledger rows on this budget’s accounts",
  },
  {
    key: "importBatches",
    label: "Import batches",
    hint: "ING batch history, items, and fingerprints on batches",
  },
  {
    key: "receiptScans",
    label: "Receipt scans",
    hint: "Bill photos, scan lines, and AI raw JSON",
  },
  {
    key: "monthlyBudgets",
    label: "Monthly plan data",
    hint: "Assignments, targets, and month notes",
  },
  {
    key: "payees",
    label: "Payees",
    hint: "Merchant / payee list",
  },
  {
    key: "schedules",
    label: "Scheduled transactions",
    hint: "Recurring templates",
  },
  {
    key: "importRules",
    label: "Import category rules",
    hint: "ING memo → category / ignore mappings (default: keep)",
  },
  {
    key: "receiptRules",
    label: "Receipt category rules",
    hint: "Bill line → category mappings (default: keep)",
  },
  {
    key: "categories",
    label: "Categories & groups",
    hint: "Envelope structure (default: keep)",
  },
  {
    key: "accounts",
    label: "Finance accounts",
    hint: "Bank / cash accounts (default: keep)",
  },
];

function ResultBanner({ result }: { result: DataToolsResult | null }) {
  if (!result) return null;
  if (result.ok) {
    return <p className="text-sm text-ok">{result.message}</p>;
  }
  return <p className="text-sm text-danger-fg">{result.error}</p>;
}

export function DataToolsClient() {
  const [pending, start] = useTransition();
  const [importResult, setImportResult] = useState<DataToolsResult | null>(null);
  const [eraseResult, setEraseResult] = useState<DataToolsResult | null>(null);

  return (
    <div className={pageStackClass}>
      <section className={`${cardCompactClass} space-y-2 p-3`}>
        <h2 className="text-sm font-semibold text-fg">Export database</h2>
        <p className="text-xs text-fg-muted">
          Download the live SQLite file. A snapshot is taken first.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/db-export" className={buttonCompactClass}>
            Download .db
          </a>
          <a href="/api/admin/db-export?gzip=1" className={buttonCompactClass}>
            Download .db.gz
          </a>
        </div>
      </section>

      <section className={`${cardCompactClass} space-y-2 p-3`}>
        <h2 className="text-sm font-semibold text-fg">Import / replace database</h2>
        <p className="text-xs text-fg-muted">
          Type <span className="font-mono text-fg">REPLACE DATABASE</span> to
          confirm. Soft-restart if balances look stale.
        </p>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              setImportResult(await importDatabaseAction(fd));
            });
          }}
        >
          <label className={labelClass}>
            File (.db / .sqlite / .gz)
            <input
              name="file"
              type="file"
              accept=".db,.sqlite,.sqlite3,.gz"
              required
              className={inputClass}
              disabled={pending}
            />
          </label>
          <label className={labelClass}>
            Confirm phrase
            <input
              name="confirm"
              className={inputClass}
              placeholder="REPLACE DATABASE"
              autoComplete="off"
              disabled={pending}
            />
          </label>
          <button
            type="submit"
            className={buttonCompactDangerClass}
            disabled={pending}
          >
            {pending ? "Working…" : "Replace database"}
          </button>
          <ResultBanner result={importResult} />
        </form>
      </section>

      <section className={`${cardCompactClass} space-y-2 p-3`}>
        <h2 className="text-sm font-semibold text-fg">Selective erase</h2>
        <p className="text-xs text-fg-muted">
          Team / users are never deleted. Defaults keep import and receipt
          mappings.
        </p>
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            start(async () => {
              setEraseResult(await selectiveEraseAction(fd));
            });
          }}
        >
          <ul className="space-y-1.5">
            {ERASE_OPTIONS.map(({ key, label, hint }) => (
              <li key={key}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name={key}
                    defaultChecked={DEFAULT_ERASE_FLAGS[key]}
                    className="mt-0.5 size-4 accent-[var(--accent)]"
                    disabled={pending}
                  />
                  <span>
                    <span className="font-medium text-fg">{label}</span>
                    <span className="mt-0.5 block text-xs text-fg-muted">
                      {hint}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <label className={labelClass}>
            Confirm phrase
            <input
              name="confirm"
              className={inputClass}
              placeholder="DELETE"
              autoComplete="off"
              disabled={pending}
            />
          </label>
          <button
            type="submit"
            className={buttonCompactDangerClass}
            disabled={pending}
          >
            {pending ? "Working…" : "Erase selected"}
          </button>
          <ResultBanner result={eraseResult} />
        </form>
      </section>
    </div>
  );
}
