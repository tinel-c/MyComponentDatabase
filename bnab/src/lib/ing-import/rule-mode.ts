/**
 * How an import mapping row is interpreted when saved.
 * Category "—" + transfer account → pure transfer twin pair.
 * Income category + transfer account → categorized statement + debit twin.
 */
export type ImportRuleMode =
  | "ignore"
  | "transfer"
  | "category"
  | "category_transfer";

export function resolveImportRuleMode(params: {
  ignore: boolean;
  categoryId: string | null | undefined;
  transferAccountId: string | null | undefined;
}): ImportRuleMode | null {
  const categoryId = params.categoryId?.trim() || null;
  const transferAccountId = params.transferAccountId?.trim() || null;
  if (params.ignore) return "ignore";
  if (transferAccountId && categoryId) return "category_transfer";
  if (transferAccountId) return "transfer";
  if (categoryId) return "category";
  return null;
}
