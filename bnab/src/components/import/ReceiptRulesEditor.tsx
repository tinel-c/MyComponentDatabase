"use client";

import { useSearchParams } from "next/navigation";
import {
  deleteReceiptRule,
  moveReceiptRule,
  updateReceiptRule,
} from "@/app/(app)/more/receipts/actions";
import {
  RulesSheetEditor,
  type RuleCategoryOption,
  type RuleRow,
} from "@/components/import/RulesSheetEditor";

export function ReceiptRulesEditor({
  rules,
  categoryOptions,
}: {
  rules: RuleRow[];
  categoryOptions: RuleCategoryOption[];
}) {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const initialRuleId = searchParams.get("rule") ?? "";

  return (
    <RulesSheetEditor
      rules={rules}
      categoryOptions={categoryOptions}
      matchMinLength={2}
      ignoreHint="Ignore line"
      initialQuery={initialQuery}
      initialRuleId={initialRuleId}
      onUpdate={updateReceiptRule}
      onMove={moveReceiptRule}
      onDelete={deleteReceiptRule}
    />
  );
}
