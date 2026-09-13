"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  buttonDangerClass,
  buttonCompactClass,
  cardClass,
  inputClass,
  labelClass,
  moneyClass,
} from "@/components/forms/field-classes";
import {
  confirmSaltEdgeSync,
  mapBankAccountLink,
  previewSaltEdgeSync,
  reconnectBankConnection,
  refreshBankConnection,
  revokeBankConnection,
  startBankConnect,
  startFakeBankConnect,
  pullConnectionsFromSaltEdge,
  syncRemoteAccounts,
  type SyncPreviewRow,
} from "@/app/(app)/more/bank-connections/actions";

type AccountOpt = { id: string; name: string };

type LinkRow = {
  id: string;
  externalAccountId: string;
  name: string | null;
  nature: string | null;
  currency: string | null;
  balanceMinor: number | null;
  financeAccountId: string | null;
};

type ConnRow = {
  id: string;
  providerCode: string | null;
  providerName: string | null;
  status: string;
  consentExpiresAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  connectionId: string | null;
  accountLinks: LinkRow[];
};

function formatMinor(n: number | null, currency: string) {
  if (n == null) return "—";
  return `${(n / 100).toFixed(2)} ${currency}`;
}

export function BankConnectionsClient(props: {
  configured: boolean;
  currency: string;
  accounts: AccountOpt[];
  connections: ConnRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    linkId: string;
    rows: SyncPreviewRow[];
    stats: {
      total: number;
      new: number;
      already: number;
      ignored: number;
      unmatched: number;
      manual: number;
      pending: number;
    };
  } | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string; redirectUrl?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      if (res.redirectUrl) {
        window.location.href = res.redirectUrl;
        return;
      }
      router.refresh();
    });
  }

  if (!props.configured) {
    return (
      <div className={`${cardClass} p-4 space-y-2`}>
        <p className="text-sm text-fg-muted">
          Salt Edge is not configured. Add{" "}
          <code className="text-fg">SALTEDGE_APP_ID</code> and{" "}
          <code className="text-fg">SALTEDGE_SECRET</code> to{" "}
          <code className="text-fg">.env</code>, then follow{" "}
          <span className="text-fg">docs/salt-edge-open-banking.md</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-danger/40 bg-danger-muted px-3 py-2 text-sm text-danger-fg">
          {error}
        </p>
      ) : null}

      <div className={`${cardClass} p-4 space-y-3`}>
        <h2 className="text-sm font-semibold text-fg">Connect</h2>
        <p className="text-sm text-fg-muted">
          Pending Partner status: use fake banks for Salt Edge validation. After
          LIVE, connect Romania → ING.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            className={buttonPrimaryClass}
            onClick={() => run(() => startBankConnect())}
          >
            Connect bank…
          </button>
          <button
            type="button"
            disabled={pending}
            className={buttonSecondaryClass}
            onClick={() => run(() => startFakeBankConnect("oauth"))}
          >
            Fake OAuth (LIVE checklist)
          </button>
          <button
            type="button"
            disabled={pending}
            className={buttonSecondaryClass}
            onClick={() => run(() => startFakeBankConnect("client"))}
          >
            Fake client (LIVE checklist)
          </button>
          <button
            type="button"
            disabled={pending}
            className={buttonSecondaryClass}
            onClick={() => run(() => pullConnectionsFromSaltEdge())}
          >
            Pull from Salt Edge
          </button>
        </div>
        <p className="text-xs text-fg-muted">
          After the Connect widget returns here, click <strong>Pull from Salt Edge</strong>{" "}
          if accounts stay empty (callbacks need a public URL — optional for this Pending step).
        </p>
      </div>

      {props.connections.length === 0 ? (
        <p className="text-sm text-fg-muted">No bank connections yet.</p>
      ) : (
        props.connections.map((c) => (
          <div key={c.id} className={`${cardClass} p-4 space-y-3`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-fg">
                  {c.providerName ?? c.providerCode ?? "Connection"}
                </h3>
                <p className="text-xs text-fg-muted">
                  Status: {c.status}
                  {c.connectionId ? ` · SE ${c.connectionId}` : " · awaiting connect"}
                  {c.consentExpiresAt
                    ? ` · consent until ${new Date(c.consentExpiresAt).toLocaleDateString()}`
                    : ""}
                  {c.lastSyncedAt
                    ? ` · synced ${new Date(c.lastSyncedAt).toLocaleString()}`
                    : ""}
                </p>
                {c.lastError ? (
                  <p className="mt-1 text-xs text-danger">{c.lastError}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={pending || !c.connectionId}
                  className={buttonCompactClass}
                  onClick={() => run(() => syncRemoteAccounts(c.id))}
                >
                  Refresh accounts
                </button>
                <button
                  type="button"
                  disabled={pending || !c.connectionId}
                  className={buttonCompactClass}
                  onClick={() => run(() => refreshBankConnection(c.id))}
                >
                  Refresh data
                </button>
                <button
                  type="button"
                  disabled={pending || !c.connectionId}
                  className={buttonCompactClass}
                  onClick={() => run(() => reconnectBankConnection(c.id))}
                >
                  Reconnect consent
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className={buttonDangerClass}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Revoke Partner consent and delete this connection?",
                      )
                    ) {
                      return;
                    }
                    run(() => revokeBankConnection(c.id));
                  }}
                >
                  Revoke
                </button>
              </div>
            </div>

            {c.accountLinks.length === 0 ? (
              <p className="text-sm text-fg-muted">
                No accounts yet — complete Connect, then Refresh accounts.
              </p>
            ) : (
              <ul className="space-y-3">
                {c.accountLinks.map((link) => (
                  <li
                    key={link.id}
                    className="rounded-xl border border-rim-subtle p-3 space-y-2"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="text-fg">
                        {link.name ?? link.externalAccountId}
                        {link.nature ? (
                          <span className="text-fg-muted"> · {link.nature}</span>
                        ) : null}
                      </span>
                      <span className={`${moneyClass} text-fg-muted`}>
                        {formatMinor(link.balanceMinor, link.currency ?? props.currency)}
                      </span>
                    </div>
                    <label className={labelClass}>
                      Map to BNAB account
                      <select
                        className={inputClass}
                        disabled={pending}
                        value={link.financeAccountId ?? ""}
                        onChange={(e) => {
                          const financeAccountId = e.target.value || null;
                          run(() =>
                            mapBankAccountLink({
                              linkId: link.id,
                              financeAccountId,
                            }),
                          );
                        }}
                      >
                        <option value="">— Not mapped —</option>
                        {props.accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={pending || !link.financeAccountId}
                      className={buttonSecondaryClass}
                      onClick={() => {
                        setError(null);
                        setPreview(null);
                        startTransition(async () => {
                          const res = await previewSaltEdgeSync(link.id);
                          if (!res.ok) {
                            setError(res.error);
                            return;
                          }
                          setPreview({
                            linkId: link.id,
                            rows: res.rows,
                            stats: res.stats,
                          });
                        });
                      }}
                    >
                      Preview sync
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}

      {preview ? (
        <div className={`${cardClass} p-4 space-y-3`}>
          <h2 className="text-sm font-semibold text-fg">Sync preview</h2>
          <p className="text-sm text-fg-muted">
            {preview.stats.total} rows · {preview.stats.new} new ·{" "}
            {preview.stats.already} already · {preview.stats.unmatched} unmatched
            · {preview.stats.ignored} ignored · {preview.stats.pending} pending
          </p>
          <div className="max-h-64 overflow-auto text-xs">
            <table className="w-full text-left">
              <thead className="text-fg-muted">
                <tr>
                  <th className="py-1 pr-2">Date</th>
                  <th className="py-1 pr-2">Memo</th>
                  <th className="py-1 pr-2">Amount</th>
                  <th className="py-1 pr-2">Status</th>
                  <th className="py-1">Rule / tip</th>
                </tr>
              </thead>
              <tbody className="text-fg">
                {preview.rows.slice(0, 100).map((r) => (
                  <tr key={r.providerTransactionId} className="border-t border-rim-subtle">
                    <td className="py-1 pr-2 whitespace-nowrap">{r.date}</td>
                    <td className="py-1 pr-2 max-w-[12rem] truncate">{r.memo}</td>
                    <td className={`py-1 pr-2 ${moneyClass}`}>
                      {(r.amount / 100).toFixed(2)}
                    </td>
                    <td className="py-1 pr-2">{r.status}</td>
                    <td className="py-1 text-fg-muted">
                      {r.categoryName ??
                        r.enrichmentSuggestion ??
                        (r.ignored ? "ignore" : "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className={buttonPrimaryClass}
              onClick={() => {
                run(async () => {
                  const res = await confirmSaltEdgeSync({
                    linkId: preview.linkId,
                  });
                  if (res.ok) setPreview(null);
                  return res;
                });
              }}
            >
              Confirm import ({preview.stats.new + preview.stats.ignored + preview.stats.unmatched} candidates)
            </button>
            <button
              type="button"
              className={buttonSecondaryClass}
              onClick={() => setPreview(null)}
            >
              Close preview
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
