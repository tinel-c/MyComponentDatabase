"use client";

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
  return (
    <RulesSheetEditor
      rules={rules}
      categoryOptions={categoryOptions}
      matchMinLength={2}
      ignoreHint="Ignore line"
      onUpdate={updateReceiptRule}
      onMove={moveReceiptRule}
      onDelete={deleteReceiptRule}
    />
  );
}
