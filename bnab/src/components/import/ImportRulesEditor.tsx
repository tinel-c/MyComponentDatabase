"use client";

import { useSearchParams } from "next/navigation";
import {
  deleteImportRule,
  moveImportRule,
  reorderImportRules,
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
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const initialRuleId = searchParams.get("rule") ?? "";

  return (
    <RulesSheetEditor
      rules={rules}
      categoryOptions={categoryOptions}
      accountOptions={accountOptions}
      matchMinLength={3}
      ignoreHint="Ignore (exclude from budget)"
      initialQuery={initialQuery}
      initialRuleId={initialRuleId}
      enableDragReorder
      onUpdate={updateImportRule}
      onMove={moveImportRule}
      onDelete={deleteImportRule}
      onReorder={reorderImportRules}
    />
  );
}
