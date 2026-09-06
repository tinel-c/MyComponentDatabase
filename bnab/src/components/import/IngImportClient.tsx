"use client";

import { useMemo, useState, useTransition } from "react";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  inputClass,
  labelClass,
} from "@/components/forms/field-classes";
import { formatMoney } from "@/lib/money";
import {
  confirmIngImport,
  createImportRuleFromForm,
  previewIngImport,
  type ConfirmDecision,
  type PreviewRow,
} from "@/app/(app)/more/import/actions";

type CategoryOption = { id: string; name: string; groupName: string };

type Props = {
  accounts: { id: string; name: string }[];
  categories: CategoryOption[];
  currency: string;
};

export function IngImportClient({ accounts, categories, currency }: Props) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [sourceLabel, setSourceLabel] = useState("paste");
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [stats, setStats] = useState<{
    total: number;
    new: number;
    already: number;
    ignored: number;
    unmatched: number;
    manual: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, ConfirmDecision>>({});
  const [pending, startTransition] = useTransition();

  const unmatched = useMemo(
    () => (rows ?? []).filter((r) => r.status === "unmatched"),
    [rows],
  );

  function onFile(file: File | null) {
    if (!file) return;
    setSourceLabel(file.name.slice(0, 200));
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result ?? ""));
      setRows(null);
      setStats(null);
    };
    reader.readAsText(file);
  }

  function runPreview() {
    setError(null);
    setMessage(null);
    const fd = new FormData();
    fd.set("accountId", accountId);
    fd.set("csv", csv);
    startTransition(async () => {
      const res = await previewIngImport(fd);
      if (!res.ok) {
        setError(res.error);
        setRows(null);
        return;
      }
      setRows(res.rows);
      setStats(res.stats);
      const next: Record<string, ConfirmDecision> = {};
      for (const r of res.rows) {
        if (r.status === "possible_manual_match") {
          next[r.fingerprint] = {
            fingerprint: r.fingerprint,
            action: "link",
            manualMatchId: r.manualMatchId,
          };
        } else if (r.status === "new" || r.status === "unmatched") {
          next[r.fingerprint] = {
            fingerprint: r.fingerprint,
            action: "import",
          };
        }
      }
      setDecisions(next);
    });
  }

  function setDecision(fp: string, patch: Partial<ConfirmDecision>) {
    setDecisions((prev) => {
      const base: ConfirmDecision = prev[fp] ?? {
        fingerprint: fp,
        action: "import",
      };
      return {
        ...prev,
        [fp]: { ...base, ...patch, fingerprint: fp },
      };
    });
  }

  function runConfirm() {
    setError(null);
    setMessage(null);
    const fd = new FormData();
    fd.set("accountId", accountId);
    fd.set("csv", csv);
    fd.set("sourceLabel", sourceLabel);
    fd.set("decisions", JSON.stringify(Object.values(decisions)));
    startTransition(async () => {
      const res = await confirmIngImport(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(`Imported ${res.created} transactions (batch ${res.batchId}).`);
      setRows(null);
      setStats(null);
    });
  }

  function saveRuleForRow(row: PreviewRow, matchText: string, categoryId: string, ignore: boolean) {
    setError(null);
    const fd = new FormData();
    fd.set("matchText", matchText);
    if (ignore) fd.set("ignore", "1");
    else fd.set("categoryId", categoryId);
    startTransition(async () => {
      const res = await createImportRuleFromForm(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage(`Rule saved for “${matchText}”. Re-running preview…`);
      runPreview();
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-xl border border-rim bg-surface p-4">
        <label className={labelClass}>
          Account
          <select
            className={inputClass}
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          ING CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className={inputClass}
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <label className={labelClass}>
          Or paste CSV
          <textarea
            className={`${inputClass} font-mono text-xs`}
            rows={8}
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setSourceLabel("paste");
              setRows(null);
            }}
            placeholder="Paste HomeBank ING export…"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonPrimaryClass}
            disabled={pending || !csv.trim()}
            onClick={runPreview}
          >
            {pending ? "Working…" : "Preview"}
          </button>
          {rows && (
            <button
              type="button"
              className={buttonSecondaryClass}
              disabled={pending}
              onClick={runConfirm}
            >
              Confirm import
            </button>
          )}
        </div>
        {error && <p className="text-sm text-danger-fg">{error}</p>}
        {message && <p className="text-sm text-ok">{message}</p>}
        {stats && (
          <p className="text-sm text-fg-muted">
            {stats.total} rows · {stats.new} new · {stats.unmatched} unmatched ·{" "}
            {stats.manual} manual matches · {stats.already} already imported ·{" "}
            {stats.ignored} ignored
          </p>
        )}
      </div>

      {unmatched.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">Create rules from unmatched</h2>
          <p className="text-sm text-fg-muted">
            Save a mapping, then preview re-runs so sibling rows update.
          </p>
          <ul className="space-y-3">
            {unmatched.slice(0, 40).map((row) => (
              <UnmatchedRuleCard
                key={row.fingerprint}
                row={row}
                categories={categories}
                currency={currency}
                disabled={pending}
                onSave={saveRuleForRow}
              />
            ))}
          </ul>
        </section>
      )}

      {rows && (
        <section className="rounded-xl border border-rim bg-surface">
          <ul className="divide-y divide-rim-subtle md:hidden">
            {rows.map((row) => (
              <li key={row.fingerprint} className="space-y-2 px-3 py-3 text-sm">
                <div className="flex justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-fg">{row.payeeGuess}</p>
                    <p className="text-xs text-fg-muted">
                      {row.date} · {row.status.replaceAll("_", " ")}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono tabular-nums text-fg">
                    {formatMoney(row.amount, currency)}
                  </p>
                </div>
                <p className="text-xs text-fg-muted">
                  {row.ignored ? "—" : row.categoryName ?? "(uncategorized)"}
                </p>
                {row.status === "possible_manual_match" ? (
                  <select
                    className={inputClass}
                    value={decisions[row.fingerprint]?.action ?? "link"}
                    onChange={(e) =>
                      setDecision(row.fingerprint, {
                        action: e.target.value as ConfirmDecision["action"],
                        manualMatchId: row.manualMatchId,
                      })
                    }
                  >
                    <option value="link">Link manual</option>
                    <option value="replace">Replace manual</option>
                    <option value="import_anyway">Import anyway</option>
                    <option value="skip">Skip</option>
                  </select>
                ) : row.status === "new" || row.status === "unmatched" ? (
                  <select
                    className={inputClass}
                    value={decisions[row.fingerprint]?.action ?? "import"}
                    onChange={(e) =>
                      setDecision(row.fingerprint, {
                        action: e.target.value as ConfirmDecision["action"],
                      })
                    }
                  >
                    <option value="import">Import</option>
                    <option value="skip">Skip</option>
                  </select>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-rim-subtle text-fg-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Payee</th>
                <th className="px-3 py-2 font-medium">Amount</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.fingerprint} className="border-b border-rim-subtle/60">
                  <td className="whitespace-nowrap px-3 py-2 text-fg">{row.date}</td>
                  <td className="max-w-[14rem] truncate px-3 py-2 text-fg" title={row.memo}>
                    {row.payeeGuess}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-fg">
                    {formatMoney(row.amount, currency)}
                  </td>
                  <td className="px-3 py-2 text-fg-muted">
                    {row.ignored ? "—" : row.categoryName ?? "(uncategorized)"}
                  </td>
                  <td className="px-3 py-2 text-fg-muted">{row.status.replaceAll("_", " ")}</td>
                  <td className="px-3 py-2">
                    {row.status === "possible_manual_match" ? (
                      <select
                        className={inputClass}
                        value={decisions[row.fingerprint]?.action ?? "link"}
                        onChange={(e) =>
                          setDecision(row.fingerprint, {
                            action: e.target.value as ConfirmDecision["action"],
                            manualMatchId: row.manualMatchId,
                          })
                        }
                      >
                        <option value="link">Link manual</option>
                        <option value="replace">Replace manual</option>
                        <option value="import_anyway">Import anyway</option>
                        <option value="skip">Skip</option>
                      </select>
                    ) : row.status === "new" || row.status === "unmatched" ? (
                      <select
                        className={inputClass}
                        value={decisions[row.fingerprint]?.action ?? "import"}
                        onChange={(e) =>
                          setDecision(row.fingerprint, {
                            action: e.target.value as ConfirmDecision["action"],
                          })
                        }
                      >
                        <option value="import">Import</option>
                        <option value="skip">Skip</option>
                      </select>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}
    </div>
  );
}

function UnmatchedRuleCard({
  row,
  categories,
  currency,
  disabled,
  onSave,
}: {
  row: PreviewRow;
  categories: CategoryOption[];
  currency: string;
  disabled: boolean;
  onSave: (
    row: PreviewRow,
    matchText: string,
    categoryId: string,
    ignore: boolean,
  ) => void;
}) {
  const [matchText, setMatchText] = useState(row.suggestedSubstring);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [ignore, setIgnore] = useState(false);

  return (
    <li className="rounded-xl border border-rim bg-surface p-3 space-y-2">
      <p className="text-sm text-fg">
        {row.date} · {formatMoney(row.amount, currency)} · {row.payeeGuess}
      </p>
      <p className="line-clamp-2 font-mono text-xs text-fg-muted" title={row.memo}>
        {row.memo}
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className={labelClass}>
          Match substring
          <input
            className={inputClass}
            value={matchText}
            onChange={(e) => setMatchText(e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Category
          <select
            className={inputClass}
            value={categoryId}
            disabled={ignore}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.groupName}: {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={ignore}
            onChange={(e) => setIgnore(e.target.checked)}
          />
          Ignore pattern
        </label>
      </div>
      <button
        type="button"
        className={buttonSecondaryClass}
        disabled={disabled || matchText.trim().length < 3}
        onClick={() => onSave(row, matchText.trim(), categoryId, ignore)}
      >
        Save rule
      </button>
    </li>
  );
}
