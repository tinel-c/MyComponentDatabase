"use client";

import {
  deleteImportRule,
  moveImportRule,
  updateImportRule,
} from "@/app/(app)/more/import/actions";
import {
  RulesSheetEditor,
  type RuleCategoryOption,
  type RuleRow,
} from "@/components/import/RulesSheetEditor";

export type ImportRuleCategoryOption = RuleCategoryOption;
export type ImportRuleRow = RuleRow;

export function ImportRulesEditor({
  rules,
  categoryOptions,
}: {
  rules: ImportRuleRow[];
  categoryOptions: ImportRuleCategoryOption[];
}) {
  return (
    <RulesSheetEditor
      rules={rules}
      categoryOptions={categoryOptions}
      matchMinLength={3}
      ignoreHint="Ignore (exclude from budget)"
      onUpdate={updateImportRule}
      onMove={moveImportRule}
      onDelete={deleteImportRule}
    />
  );
}
