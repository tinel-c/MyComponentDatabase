"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { InfiniteList } from "@/components/ui/InfiniteList";
import { loadMoreImportBatchItems } from "@/app/(app)/more/import-history/load-more";
import type {
  ImportHistoryItemFilters,
  ImportHistoryItemRow,
} from "@/lib/import-history-items-chunk";
import {
  denseTdClass,
  tableClass,
  denseThClass,
} from "@/components/forms/field-classes";

const ACTION_LABELS: Record<string, string> = {
  created: "Created",
  created_transfer_twin: "Transfer twin",
  linked_manual: "Linked existing",
  linked_receipt_scan: "Linked bill scan",
  skipped_duplicate: "Skipped duplicate",
};

const CLASS_LABELS: Record<string, string> = {
  new: "New ledger entry",
  linked_existing: "Linked existing payment",
  duplicate: "Already imported",
  rule_category: "Categorized by import rule",
  rule_transfer: "Transfer by import rule",
  rule_hybrid: "Income + transfer twin",
  rule_ignore: "Ignore-rule (RTA excluded)",
  planned_match: "Matched planned payment",
  unmatched: "No rule / no plan",
};

function importRuleHref(ruleId: string, matchText: string) {
  const params = new URLSearchParams({
    rule: ruleId,
    q: matchText,
  });
  return `/more/import-rules?${params.toString()}`;
}

export function ImportHistoryItemsInfinite({
  batchId,
  initialItems,
  initialCursor,
  hasMore,
  filters = {},
  ruleById: initialRules,
  scheduleLabelById: initialSchedules,
}: {
  batchId: string;
  initialItems: ImportHistoryItemRow[];
  initialCursor: string | null;
  hasMore: boolean;
  filters?: ImportHistoryItemFilters;
  ruleById: Record<string, string>;
  scheduleLabelById: Record<string, string>;
}) {
  const [ruleById, setRuleById] = useState(initialRules);
  const [scheduleLabelById, setScheduleLabelById] = useState(initialSchedules);

  const loadMore = useCallback(
    async (cursor: string) => {
      const res = await loadMoreImportBatchItems({ batchId, cursor, filters });
      setRuleById((prev) => ({ ...prev, ...res.ruleById }));
      setScheduleLabelById((prev) => ({ ...prev, ...res.scheduleLabelById }));
      return {
        items: res.items,
        nextCursor: res.nextCursor,
        hasMore: res.hasMore,
      };
    },
    [batchId, filters],
  );

  return (
    <InfiniteList
      initialItems={initialItems}
      initialCursor={initialCursor}
      hasMore={hasMore}
      loadMore={loadMore}
      endLabel="End of batch items"
      renderList={(items) => (
        <div className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={denseThClass}>Memo</th>
                <th className={denseThClass}>Outcome</th>
                <th className={denseThClass}>Rule hit</th>
                <th className={denseThClass}>Planned payment</th>
                <th className={denseThClass}>Identified as</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const ruleText = item.importRuleId
                  ? (ruleById[item.importRuleId] ?? null)
                  : null;
                return (
                  <tr key={item.id}>
                    <td className={denseTdClass}>
                      {item.transactionId ? (
                        <Link
                          href={`/transactions/${item.transactionId}`}
                          className="text-accent hover:underline"
                        >
                          {item.memoPreview?.slice(0, 60) || "—"}
                        </Link>
                      ) : (
                        item.memoPreview?.slice(0, 60) || "—"
                      )}
                    </td>
                    <td className={denseTdClass}>
                      {ACTION_LABELS[item.action] ?? item.action}
                    </td>
                    <td className={denseTdClass}>
                      {item.importRuleId && ruleText ? (
                        <Link
                          href={importRuleHref(item.importRuleId, ruleText)}
                          className="text-accent hover:underline"
                        >
                          {ruleText}
                        </Link>
                      ) : item.importRuleId ? (
                        <Link
                          href={`/more/import-rules?rule=${encodeURIComponent(item.importRuleId)}`}
                          className="text-accent hover:underline"
                        >
                          Rule
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={denseTdClass}>
                      {item.scheduledTransactionId ? (
                        <Link
                          href={`/planned?id=${item.scheduledTransactionId}`}
                          className="text-accent hover:underline"
                        >
                          {scheduleLabelById[item.scheduledTransactionId] ??
                            "Planned"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={denseTdClass}>
                      {item.classification
                        ? (CLASS_LABELS[item.classification] ??
                          item.classification)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    />
  );
}
