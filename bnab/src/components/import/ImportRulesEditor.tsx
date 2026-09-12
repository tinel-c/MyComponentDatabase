"use client";

import {
  deleteImportRule,
  moveImportRule,
  updateImportRule,
} from "@/app/(app)/more/import/actions";
import {
  RulesSheetEditor,
  type RuleAccountOption,
  type RuleCategoryOption,
  type RuleRow,
} from "@/components/import/RulesSheetEditor";

export type ImportRuleCategoryOption = RuleCategoryOption;
export type ImportRuleAccountOption = RuleAccountOption;
export type ImportRuleRow = RuleRow;

export function ImportRulesEditor({
  rules,
  categoryOptions,
  accountOptions,
}: {
  rules: ImportRuleRow[];
  categoryOptions: ImportRuleCategoryOption[];
  accountOptions: ImportRuleAccountOption[];
}) {
  return (
    <RulesSheetEditor
      rules={rules}
      categoryOptions={categoryOptions}
      accountOptions={accountOptions}
      matchMinLength={3}
      ignoreHint="Ignore (exclude from budget)"
      onUpdate={updateImportRule}
      onMove={moveImportRule}
      onDelete={deleteImportRule}
    />
  );
}
