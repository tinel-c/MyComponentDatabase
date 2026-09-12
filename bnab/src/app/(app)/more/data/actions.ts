"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requireBudgetAccess } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { replaceDatabaseFromUpload } from "@/lib/data-tools/db-file";
import {
  parseEraseFlags,
  selectiveEraseBudget,
} from "@/lib/data-tools/selective-erase";

export type DataToolsResult = { ok: true; message: string } | { ok: false; error: string };

export async function importDatabaseAction(
  formData: FormData,
): Promise<DataToolsResult> {
  await requireAdmin();
  await requireBudgetAccess();

  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== "REPLACE DATABASE") {
    return { ok: false, error: 'Type REPLACE DATABASE to confirm.' };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a .db / .sqlite / .gz file." };
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await prisma.$disconnect();
    const { snapshotRelative } = await replaceDatabaseFromUpload({
      bytes,
      filename: file.name,
    });
    await prisma.$connect();
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: `Database replaced. Pre-import snapshot: ${snapshotRelative}. If the app looks stale, soft-restart PM2 (or reload the process).`,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Import failed",
    };
  }
}

export async function selectiveEraseAction(
  formData: FormData,
): Promise<DataToolsResult> {
  await requireAdmin();
  const { budget } = await requireBudgetAccess();

  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== "DELETE") {
    return { ok: false, error: 'Type DELETE to confirm selective erase.' };
  }

  const flags = parseEraseFlags((name) => formData.get(name));
  const any = Object.values(flags).some(Boolean);
  if (!any) {
    return { ok: false, error: "Select at least one category to erase." };
  }

  try {
    const result = await selectiveEraseBudget(prisma, budget.id, flags);
    revalidatePath("/", "layout");
    const extras: string[] = [];
    if (result.reseededImportRules) extras.push("reseeded default import rules");
    if (result.reseededReceiptRules) extras.push("reseeded default receipt rules");
    return {
      ok: true,
      message:
        "Selective erase completed." +
        (extras.length ? ` (${extras.join("; ")})` : ""),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Erase failed",
    };
  }
}
