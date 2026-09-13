"use server";

import { revalidatePath } from "next/cache";
import { requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { invalidateBudgetCaches } from "@/lib/cache-tags";
import {
  parseEraseFlags,
  selectiveEraseBudget,
} from "@/lib/data-tools/selective-erase";
import type { DataToolsResult } from "@/app/(app)/more/data/actions";

/** Fresh Start: ADMIN or EDITOR budget members (any membership). */
export async function freshStartEraseAction(
  formData: FormData,
): Promise<DataToolsResult> {
  const { budget, membership } = await requireBudgetAccess();
  if (membership.role !== "ADMIN" && membership.role !== "EDITOR") {
    return { ok: false, error: "Only budget admins or editors can Fresh Start." };
  }

  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== "DELETE") {
    return { ok: false, error: 'Type DELETE to confirm Fresh Start erase.' };
  }

  const flags = parseEraseFlags((name) => formData.get(name));
  const any = Object.values(flags).some(Boolean);
  if (!any) {
    return { ok: false, error: "Select at least one category to erase." };
  }

  try {
    const result = await selectiveEraseBudget(prisma, budget.id, flags);
    // Wish farm is independent of selective-erase flags; wipe when ledger resets.
    if (flags.transactions || flags.monthlyBudgets) {
      await prisma.wishItem.deleteMany({ where: { budgetId: budget.id } });
    }
    invalidateBudgetCaches(budget.id);
    revalidatePath("/", "layout");
    const extras: string[] = [];
    if (result.reseededImportRules) extras.push("reseeded default import rules");
    if (result.reseededReceiptRules) extras.push("reseeded default receipt rules");
    return {
      ok: true,
      message:
        "Fresh Start erase completed." +
        (extras.length ? ` (${extras.join("; ")})` : ""),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Fresh Start failed",
    };
  }
}
