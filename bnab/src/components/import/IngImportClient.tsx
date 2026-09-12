"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  cardCompactClass,
  inputClass,
  labelClass,
  pageStackClass,
} from "@/components/forms/field-classes";
import { formatMoney } from "@/lib/money";
import { applyNewRuleToPreviewRows } from "@/lib/ing-import/overlap";
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

function importRuleHref(row: PreviewRow): string | null {
  if (!row.matchedRuleId || !row.matchedRuleMatchText) return null;
  const params = new URLSearchParams({
    rule: row.matchedRuleId,
    q: row.matchedRuleMatchText,
  });
  return `/more/import-rules?${params.toString()}`;
}

function ImportMatchedRuleLabel({ row }: { row: PreviewRow }) {
  const parts: string[] = [];
  if (row.ignored) {
    parts.push("Ignore");
  } else {
    if (row.categoryName) parts.push(row.categoryName);
    if (row.transferAccountName) {
      parts.push(`↔ ${row.transferAccountName}`);
    }
  }
  const label = parts.length > 0 ? parts.join(" · ") : "(uncategorized)";
  const href = importRuleHref(row);
  if (!href) {
    return <span className="text-fg-muted">{label}</span>;
  }
  return (
    <Link
      href={href}
      className="text-accent hover:underline"
      title={`Open mapping: ${row.matchedRuleMatchText}`}
    >
      {label}
    </Link>
  );
}

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

  function applyPreviewResult(res: Exclude<Awaited<ReturnType<typeof previewIngImport>>, { ok: false }>) {
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
      } else if (
        r.status === "new" ||
        r.status === "unmatched" ||
        r.status === "ignored"
      ) {
        next[r.fingerprint] = {
          fingerprint: r.fingerprint,
          action: "import",
        };
      }
    }
    setDecisions(next);
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
      applyPreviewResult(res);
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

  function saveRuleForRow(
    _row: PreviewRow,
    matchText: string,
    categoryId: string,
    ignore: boolean,
    transferAccountId: string,
  ) {
    setError(null);
    const needle = matchText.trim();
    if (needle.length < 3) {
      setError("Match text must be at least 3 characters");
      return;
    }
    const fd = new FormData();
    fd.set("matchText", needle);
    if (ignore) fd.set("ignore", "1");
    else {
      if (categoryId) fd.set("categoryId", categoryId);
      if (transferAccountId) fd.set("transferAccountId", transferAccountId);
    }

    const cat = categories.find((c) => c.id === categoryId);
    const categoryName = cat ? `${cat.groupName}: ${cat.name}` : null;
    const transferAccountName =
      accounts.find((a) => a.id === transferAccountId)?.name ?? null;

    startTransition(async () => {
      const res = await createImportRuleFromForm(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }

      // Substring anywhere in memo (case-insensitive): clear matching unmatched
      // rows immediately, then refresh preview from server rules.
      setRows((prev) => {
        if (!prev) return prev;
        const applied = applyNewRuleToPreviewRows(prev, {
          matchText: needle,
          ignore,
          categoryId: ignore ? null : categoryId || null,
          categoryName: ignore || !categoryId ? null : categoryName,
          transferAccountId: ignore ? null : transferAccountId || null,
          transferAccountName: ignore ? null : transferAccountName,
        });
        setStats(applied.stats);
        setDecisions((prevDec) => {
          const next = { ...prevDec };
          for (const fp of applied.matchedFingerprints) {
            const status = applied.rows.find((r) => r.fingerprint === fp)?.status;
            if (status === "ignored" || status === "new") {
              next[fp] = { fingerprint: fp, action: "import" };
            }
          }
          return next;
        });
        const cleared = applied.matchedFingerprints.filter((fp) => {
          const before = prev.find((r) => r.fingerprint === fp);
          return before?.status === "unmatched";
        }).length;
        setMessage(
          `Rule “${needle}” saved — cleared ${cleared} unmatched match${cleared === 1 ? "" : "es"}. Refreshing…`,
        );
        return applied.rows;
      });

      const previewFd = new FormData();
      previewFd.set("accountId", accountId);
      previewFd.set("csv", csv);
      const preview = await previewIngImport(previewFd);
      if (!preview.ok) {
        setError(preview.error);
        setMessage(
          `Rule “${needle}” saved, but preview refresh failed — unmatched list may be stale.`,
        );
        return;
      }
      applyPreviewResult(preview);
      setMessage(
        `Rule “${needle}” saved. ${preview.stats.unmatched} unmatched remaining.`,
      );
    });
  }

  return (
    <div className={pageStackClass}>
      <div className={`${cardCompactClass} space-y-2 p-3`}>
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
              className={buttonCompactClass}
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
            {stats.ignored} ignored → ledger (excluded from budget)
          </p>
        )}
      </div>

      {unmatched.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-fg">Create rules from unmatched</h2>
          <p className="text-sm text-fg-muted">
            Match text can be any substring in the memo (not only the start).
            Saving a rule re-applies mappings and removes every unmatched row that
            contains that substring.
          </p>
          <ul className="space-y-3">
            {unmatched.slice(0, 40).map((row) => (
              <UnmatchedRuleCard
                key={row.fingerprint}
                row={row}
                categories={categories}
                accounts={accounts.filter((a) => a.id !== accountId)}
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
                <p className="text-xs">
                  <ImportMatchedRuleLabel row={row} />
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
                ) : row.status === "new" ||
                  row.status === "unmatched" ||
                  row.status === "ignored" ? (
                  <select
                    className={inputClass}
                    value={decisions[row.fingerprint]?.action ?? "import"}
                    onChange={(e) =>
                      setDecision(row.fingerprint, {
                        action: e.target.value as ConfirmDecision["action"],
                      })
                    }
                  >
                    <option value="import">
                      {row.status === "ignored"
                        ? "Import (exclude from budget)"
                        : "Import"}
                    </option>
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
                  <td className="px-3 py-2">
                    <ImportMatchedRuleLabel row={row} />
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
                    ) : row.status === "new" ||
                      row.status === "unmatched" ||
                      row.status === "ignored" ? (
                      <select
                        className={inputClass}
                        value={decisions[row.fingerprint]?.action ?? "import"}
                        onChange={(e) =>
                          setDecision(row.fingerprint, {
                            action: e.target.value as ConfirmDecision["action"],
                          })
                        }
                      >
                        <option value="import">
                          {row.status === "ignored"
                            ? "Import (exclude from budget)"
                            : "Import"}
                        </option>
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
  accounts,
  currency,
  disabled,
  onSave,
}: {
  row: PreviewRow;
  categories: CategoryOption[];
  accounts: { id: string; name: string }[];
  currency: string;
  disabled: boolean;
  onSave: (
    row: PreviewRow,
    matchText: string,
    categoryId: string,
    ignore: boolean,
    transferAccountId: string,
  ) => void;
}) {
  const [matchText, setMatchText] = useState(row.suggestedSubstring);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [transferAccountId, setTransferAccountId] = useState("");
  const [ignore, setIgnore] = useState(false);

  const canSave =
    matchText.trim().length >= 3 &&
    (ignore || Boolean(transferAccountId) || Boolean(categoryId));

  return (
    <li className="rounded-xl border border-rim bg-surface p-3 space-y-2">
      <p className="text-sm text-fg">
        {row.date} · {formatMoney(row.amount, currency)} · {row.payeeGuess}
      </p>
      <p className="line-clamp-2 font-mono text-xs text-fg-muted" title={row.memo}>
        {row.memo}
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
        <label className={labelClass}>
          Transfer / debit account
          <select
            className={inputClass}
            value={transferAccountId}
            disabled={ignore}
            onChange={(e) => {
              setTransferAccountId(e.target.value);
              if (e.target.value) setIgnore(false);
            }}
          >
            <option value="">— none —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 pb-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={ignore}
            onChange={(e) => {
              setIgnore(e.target.checked);
              if (e.target.checked) setTransferAccountId("");
            }}
          />
          Ignore pattern
        </label>
      </div>
      <button
        type="button"
        className={buttonCompactClass}
        disabled={disabled || !canSave}
        onClick={() =>
          onSave(
            row,
            matchText.trim(),
            categoryId,
            ignore,
            transferAccountId,
          )
        }
      >
        Save rule
      </button>
    </li>
  );
}
