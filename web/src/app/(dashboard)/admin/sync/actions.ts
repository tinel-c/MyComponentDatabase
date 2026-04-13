"use server";

import { requireAdmin } from "@/lib/authz";
import { exportInventory } from "@/lib/sync";

export type PushToProductionResult =
  | { ok: true; summary: Record<string, number> }
  | { ok: false; error: string };

export async function pushInventoryToProduction(): Promise<PushToProductionResult> {
  await requireAdmin();
  const base = process.env.SYNC_TARGET_URL?.trim().replace(/\/$/, "");
  const secret = process.env.SYNC_TARGET_SECRET?.trim();
  if (!base || !secret) {
    return {
      ok: false,
      error:
        "Set SYNC_TARGET_URL and SYNC_TARGET_SECRET in the server environment (for example dev .env).",
    };
  }

  const payload = await exportInventory();
  const res = await fetch(`${base}/api/admin/sync/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (typeof j.error === "string" && j.error) msg = j.error;
    } catch {
      /* use raw text */
    }
    return { ok: false, error: msg || `${res.status} ${res.statusText}` };
  }

  try {
    const j = JSON.parse(text) as { summary?: Record<string, number> };
    return { ok: true, summary: j.summary ?? {} };
  } catch {
    return { ok: true, summary: {} };
  }
}
