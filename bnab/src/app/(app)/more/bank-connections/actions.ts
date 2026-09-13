"use server";

import { revalidatePath } from "next/cache";
import { requireBudgetAccess } from "@/lib/authz";
import { invalidateBudgetCaches } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import {
  classifyIngRowAgainstLedger,
  planIngConfirmAction,
} from "@/lib/ing-import/overlap";
import { createDbSnapshot } from "@/lib/ing-import/snapshot";
import {
  ensureYngsbCategories,
  seedDefaultImportRules,
} from "@/lib/starter-categories";
import {
  applyRulesToSaltEdgeRows,
  createLead,
  createLeadSession,
  createReconnectSession,
  createRefreshSession,
  isSaltEdgeConfigured,
  listAllTransactions,
  listAccounts,
  listConnections,
  normalizeSaltEdgeTransactions,
  refreshConnection,
  removeConnection,
  showConnection,
  suggestImportRuleFromEnrichment,
  SALTEDGE_MANDATORY_FAKE_CODES,
  SaltEdgeApiError,
} from "@/lib/saltedge";
import type { AppliedSaltEdgeRow } from "@/lib/saltedge";

export type ActionResult =
  | { ok: true; [key: string]: unknown }
  | { ok: false; error: string };

function errMessage(e: unknown): string {
  if (e instanceof SaltEdgeApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Unexpected error";
}

export async function getSaltEdgeStatus(): Promise<{
  configured: boolean;
  returnTo: string | null;
}> {
  const configured = isSaltEdgeConfigured();
  return {
    configured,
    returnTo: configured
      ? (process.env.SALTEDGE_RETURN_TO ??
          `${(process.env.AUTH_URL ?? "").replace(/\/$/, "")}/more/bank-connections`)
      : null,
  };
}

/** Start Connect widget (fake banks while Pending; ING when Live). */
export async function startBankConnect(params?: {
  providerCode?: string;
}): Promise<ActionResult & { redirectUrl?: string; connectionLocalId?: string }> {
  const { budget, session } = await requireBudgetAccess();
  if (!isSaltEdgeConfigured()) {
    return {
      ok: false,
      error:
        "Salt Edge is not configured. Set SALTEDGE_APP_ID and SALTEDGE_SECRET.",
    };
  }

  const email = session.user.email;
  if (!email) return { ok: false, error: "Signed-in user has no email" };

  try {
    // Reuse Salt Edge customer (v6) if we already created one for this budget.
    const existingLead = await prisma.bankProviderConnection.findFirst({
      where: { budgetId: budget.id },
      orderBy: { createdAt: "desc" },
      select: { leadId: true },
    });
    let leadId = existingLead?.leadId?.trim() || "";
    if (!leadId) {
      const lead = await createLead(email);
      leadId = lead.customer_id;
    }
    const local = await prisma.bankProviderConnection.create({
      data: {
        budgetId: budget.id,
        leadId,
        status: "pending",
        providerCode: params?.providerCode ?? null,
      },
    });

    const sessionRes = await createLeadSession({
      customerId: leadId,
      providerCode: params?.providerCode,
    });

    return {
      ok: true,
      redirectUrl: sessionRes.redirect_url,
      connectionLocalId: local.id,
    };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function startFakeBankConnect(
  which: "oauth" | "client" = "oauth",
): Promise<ActionResult & { redirectUrl?: string }> {
  const code =
    which === "oauth"
      ? SALTEDGE_MANDATORY_FAKE_CODES[0]
      : SALTEDGE_MANDATORY_FAKE_CODES[1];
  return startBankConnect({ providerCode: code });
}

/**
 * After Connect widget return (and when callbacks are not reachable yet),
 * pull Salt Edge connections for known leads and upsert local rows + accounts.
 */
export async function pullConnectionsFromSaltEdge(): Promise<
  ActionResult & { updated?: number }
> {
  const { budget } = await requireBudgetAccess();
  if (!isSaltEdgeConfigured()) {
    return { ok: false, error: "Salt Edge is not configured" };
  }

  const locals = await prisma.bankProviderConnection.findMany({
    where: { budgetId: budget.id, status: { not: "destroyed" } },
  });
  const leadIds = [...new Set(locals.map((l) => l.leadId).filter(Boolean))];
  if (leadIds.length === 0) {
    return {
      ok: false,
      error: "No local connections yet — start Fake OAuth / Connect bank first",
    };
  }

  let updated = 0;
  try {
    for (const leadId of leadIds) {
      const remoteList = await listConnections(leadId);
      for (const remote of remoteList) {
        const consentRaw = remote.consent?.expires_at;
        const consentExpiresAt = consentRaw ? new Date(consentRaw) : null;
        let row = await prisma.bankProviderConnection.findFirst({
          where: {
            budgetId: budget.id,
            OR: [
              { connectionId: remote.id },
              { leadId, connectionId: null },
            ],
          },
          orderBy: { createdAt: "desc" },
        });
        if (row) {
          await prisma.bankProviderConnection.update({
            where: { id: row.id },
            data: {
              connectionId: remote.id,
              leadId,
              providerCode: remote.provider_code ?? row.providerCode,
              providerName: remote.provider_name ?? row.providerName,
              status: remote.status ?? "active",
              consentExpiresAt: consentExpiresAt ?? row.consentExpiresAt,
              lastError: null,
            },
          });
        } else {
          row = await prisma.bankProviderConnection.create({
            data: {
              budgetId: budget.id,
              leadId,
              connectionId: remote.id,
              providerCode: remote.provider_code ?? null,
              providerName: remote.provider_name ?? null,
              status: remote.status ?? "active",
              consentExpiresAt,
            },
          });
        }
        updated++;

        try {
          const accounts = await listAccounts(remote.id);
          for (const acc of accounts) {
            const balanceMajor = Number(acc.balance);
            const balanceMinor = Number.isFinite(balanceMajor)
              ? Math.round(balanceMajor * 100)
              : null;
            await prisma.bankAccountLink.upsert({
              where: {
                connectionId_externalAccountId: {
                  connectionId: row.id,
                  externalAccountId: String(acc.id),
                },
              },
              create: {
                connectionId: row.id,
                externalAccountId: String(acc.id),
                name: acc.name ?? null,
                nature: acc.nature ?? null,
                currency: acc.currency_code ?? null,
                balanceMinor,
                lastBalanceAt: balanceMinor != null ? new Date() : null,
              },
              update: {
                name: acc.name ?? null,
                nature: acc.nature ?? null,
                currency: acc.currency_code ?? null,
                balanceMinor,
                lastBalanceAt: balanceMinor != null ? new Date() : null,
              },
            });
          }
        } catch {
          // accounts may still be fetching
        }
      }
    }
    revalidatePath("/more/bank-connections");
    return { ok: true, updated };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function reconnectBankConnection(
  localConnectionId: string,
): Promise<ActionResult & { redirectUrl?: string }> {
  const { budget } = await requireBudgetAccess();
  const row = await prisma.bankProviderConnection.findFirst({
    where: { id: localConnectionId, budgetId: budget.id },
  });
  if (!row?.connectionId) {
    return { ok: false, error: "Connection not linked to Salt Edge yet" };
  }
  try {
    const sessionRes = await createReconnectSession({
      connectionId: row.connectionId,
    });
    await prisma.bankProviderConnection.update({
      where: { id: row.id },
      data: { status: "reconnecting", lastError: null },
    });
    return { ok: true, redirectUrl: sessionRes.redirect_url };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function refreshBankConnection(
  localConnectionId: string,
): Promise<ActionResult & { redirectUrl?: string }> {
  const { budget } = await requireBudgetAccess();
  const row = await prisma.bankProviderConnection.findFirst({
    where: { id: localConnectionId, budgetId: budget.id },
  });
  if (!row?.connectionId) {
    return { ok: false, error: "Connection not linked to Salt Edge yet" };
  }

  let nextAt: string | null = null;
  try {
    const shown = await showConnection(row.connectionId);
    nextAt = shown.next_refresh_possible_at ?? null;
    if (nextAt) {
      const when = new Date(nextAt).getTime();
      if (Number.isFinite(when) && when > Date.now() + 5_000) {
        const msg = `Salt Edge rate-limit: next refresh possible at ${new Date(nextAt).toLocaleString()}. Use Reconnect consent if you need a fetch sooner, or Preview sync for already-fetched data.`;
        await prisma.bankProviderConnection.update({
          where: { id: row.id },
          data: { status: "active", lastError: null },
        });
        return { ok: false, error: msg };
      }
    }
  } catch {
    /* continue — still try refresh */
  }

  // Prefer widget refresh. Background refresh is often blocked by next_refresh_possible_at.
  try {
    const session = await createRefreshSession({
      connectionId: row.connectionId,
    });
    await prisma.bankProviderConnection.update({
      where: { id: row.id },
      data: { status: "refreshing", lastError: null },
    });
    return { ok: true, redirectUrl: session.redirect_url };
  } catch {
    try {
      const remote = await refreshConnection(row.connectionId);
      await prisma.bankProviderConnection.update({
        where: { id: row.id },
        data: {
          status: remote.status ?? "refreshing",
          lastError: null,
        },
      });
      revalidatePath("/more/bank-connections");
      return { ok: true };
    } catch (bgErr) {
      if (!nextAt) {
        try {
          const shown = await showConnection(row.connectionId);
          nextAt = shown.next_refresh_possible_at ?? null;
        } catch {
          /* ignore */
        }
      }
      const base = errMessage(bgErr);
      const hint = nextAt
        ? ` Next refresh possible at ${new Date(nextAt).toLocaleString()}. Reconnect consent still works anytime.`
        : " Try Reconnect consent, or wait for Salt Edge next_refresh_possible_at.";
      const msg = `${base}.${hint}`;
      await prisma.bankProviderConnection.update({
        where: { id: row.id },
        data: { status: "active", lastError: null },
      });
      return { ok: false, error: msg };
    }
  }
}

export async function revokeBankConnection(
  localConnectionId: string,
): Promise<ActionResult> {
  const { budget } = await requireBudgetAccess();
  const row = await prisma.bankProviderConnection.findFirst({
    where: { id: localConnectionId, budgetId: budget.id },
  });
  if (!row) return { ok: false, error: "Connection not found" };

  try {
    if (row.connectionId) {
      await removeConnection(row.connectionId);
    }
  } catch (e) {
    // Still mark local destroyed so UX can proceed
    await prisma.bankProviderConnection.update({
      where: { id: row.id },
      data: {
        status: "destroyed",
        lastError: errMessage(e),
      },
    });
    revalidatePath("/more/bank-connections");
    return { ok: false, error: errMessage(e) };
  }

  await prisma.bankAccountLink.deleteMany({ where: { connectionId: row.id } });
  await prisma.bankProviderConnection.delete({ where: { id: row.id } });
  revalidatePath("/more/bank-connections");
  return { ok: true };
}

export async function syncRemoteAccounts(
  localConnectionId: string,
): Promise<ActionResult> {
  const { budget } = await requireBudgetAccess();
  const row = await prisma.bankProviderConnection.findFirst({
    where: { id: localConnectionId, budgetId: budget.id },
  });
  if (!row?.connectionId) {
    return { ok: false, error: "Connection not linked to Salt Edge yet" };
  }
  try {
    const remote = await showConnection(row.connectionId);
    const consentRaw = remote.consent?.expires_at;
    await prisma.bankProviderConnection.update({
      where: { id: row.id },
      data: {
        providerCode: remote.provider_code ?? row.providerCode,
        providerName: remote.provider_name ?? row.providerName,
        status: remote.status ?? row.status,
        consentExpiresAt: consentRaw ? new Date(consentRaw) : row.consentExpiresAt,
      },
    });
    const accounts = await listAccounts(row.connectionId);
    for (const acc of accounts) {
      const balanceMajor = Number(acc.balance);
      const balanceMinor = Number.isFinite(balanceMajor)
        ? Math.round(balanceMajor * 100)
        : null;
      await prisma.bankAccountLink.upsert({
        where: {
          connectionId_externalAccountId: {
            connectionId: row.id,
            externalAccountId: String(acc.id),
          },
        },
        create: {
          connectionId: row.id,
          externalAccountId: String(acc.id),
          name: acc.name ?? null,
          nature: acc.nature ?? null,
          currency: acc.currency_code ?? null,
          balanceMinor,
          lastBalanceAt: balanceMinor != null ? new Date() : null,
        },
        update: {
          name: acc.name ?? null,
          nature: acc.nature ?? null,
          currency: acc.currency_code ?? null,
          balanceMinor,
          lastBalanceAt: balanceMinor != null ? new Date() : null,
        },
      });
    }
    revalidatePath("/more/bank-connections");
    return { ok: true, count: accounts.length };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function mapBankAccountLink(params: {
  linkId: string;
  financeAccountId: string | null;
}): Promise<ActionResult> {
  const { budget } = await requireBudgetAccess();
  const link = await prisma.bankAccountLink.findFirst({
    where: { id: params.linkId, connection: { budgetId: budget.id } },
  });
  if (!link) return { ok: false, error: "Account link not found" };

  if (params.financeAccountId) {
    const fa = await prisma.financeAccount.findFirst({
      where: { id: params.financeAccountId, budgetId: budget.id },
    });
    if (!fa) return { ok: false, error: "Finance account not found" };
  }

  await prisma.bankAccountLink.update({
    where: { id: link.id },
    data: { financeAccountId: params.financeAccountId },
  });
  revalidatePath("/more/bank-connections");
  return { ok: true };
}

export type SyncPreviewRow = AppliedSaltEdgeRow & {
  status: NonNullable<AppliedSaltEdgeRow["status"]>;
  manualMatchId?: string | null;
  categoryName: string | null;
  enrichmentSuggestion: string | null;
};

export type SyncPreviewResult =
  | {
      ok: true;
      rows: SyncPreviewRow[];
      stats: {
        total: number;
        new: number;
        already: number;
        ignored: number;
        unmatched: number;
        manual: number;
        pending: number;
      };
    }
  | { ok: false; error: string };

export async function previewSaltEdgeSync(
  linkId: string,
): Promise<SyncPreviewResult> {
  const { budget } = await requireBudgetAccess();
  const link = await prisma.bankAccountLink.findFirst({
    where: { id: linkId, connection: { budgetId: budget.id } },
    include: { connection: true },
  });
  if (!link?.financeAccountId) {
    return { ok: false, error: "Map this bank account to a BNAB account first" };
  }
  if (!link.connection.connectionId) {
    return { ok: false, error: "Salt Edge connection id missing" };
  }

  await ensureYngsbCategories(prisma, budget.id);
  await seedDefaultImportRules(prisma, budget.id);

  try {
    const txns = await listAllTransactions({
      connectionId: link.connection.connectionId,
      accountId: link.externalAccountId,
    });
    const normalized = normalizeSaltEdgeTransactions(txns);
    const rules = await prisma.importCategoryRule.findMany({
      where: { budgetId: budget.id },
      orderBy: { sortOrder: "asc" },
    });
    const cats = await prisma.category.findMany({
      where: { group: { budgetId: budget.id } },
      select: { id: true, name: true },
    });
    const nameById = new Map(cats.map((c) => [c.id, c.name]));
    const applied = applyRulesToSaltEdgeRows(
      normalized,
      rules,
      link.financeAccountId,
      nameById,
    );

    const fps = applied.map((r) => r.fingerprint);
    const providerIds = applied.map((r) => r.providerTransactionId);
    const existing = await prisma.transaction.findMany({
      where: {
        accountId: link.financeAccountId,
        OR: [
          { importFingerprint: { in: fps } },
          { providerTransactionId: { in: providerIds } },
        ],
      },
      select: {
        importFingerprint: true,
        providerTransactionId: true,
      },
    });
    const existingSet = new Set<string>();
    for (const e of existing) {
      if (e.importFingerprint) existingSet.add(e.importFingerprint);
      // Also treat provider-id hits as already imported by marking fingerprint
    }
    const existingProvider = new Set(
      existing
        .map((e) => e.providerTransactionId)
        .filter((x): x is string => Boolean(x)),
    );

    const manuals = await prisma.transaction.findMany({
      where: {
        accountId: link.financeAccountId,
        importFingerprint: null,
        isChild: false,
      },
      select: {
        id: true,
        date: true,
        amount: true,
        notes: true,
        payee: { select: { name: true } },
      },
    });
    const manualLedger = manuals.map((m) => ({
      id: m.id,
      date: m.date,
      amount: m.amount,
      notes: m.notes,
      payeeName: m.payee?.name ?? null,
    }));

    const rows: SyncPreviewRow[] = applied.map((r) => {
      const providerHit = existingProvider.has(r.providerTransactionId);
      const { status, manualMatchId } = classifyIngRowAgainstLedger(
        r,
        providerHit ? new Set([...existingSet, r.fingerprint]) : existingSet,
        manualLedger,
      );
      const suggestion = suggestImportRuleFromEnrichment({
        description: r.memo,
        saltEdgeCategory: r.saltEdgeCategory,
        extra: null,
      });
      return {
        ...r,
        status,
        manualMatchId,
        categoryName: r.categoryId ? nameById.get(r.categoryId) ?? null : null,
        enrichmentSuggestion:
          status === "unmatched" ? (suggestion?.matchText ?? null) : null,
      };
    });

    return {
      ok: true,
      rows,
      stats: {
        total: rows.length,
        new: rows.filter((r) => r.status === "new").length,
        already: rows.filter((r) => r.status === "already_imported").length,
        ignored: rows.filter((r) => r.status === "ignored").length,
        unmatched: rows.filter((r) => r.status === "unmatched").length,
        manual: rows.filter((r) => r.status === "possible_manual_match").length,
        pending: rows.filter((r) => r.pending).length,
      },
    };
  } catch (e) {
    return { ok: false, error: errMessage(e) };
  }
}

export async function confirmSaltEdgeSync(params: {
  linkId: string;
  /** When empty, import all non-duplicate / non-skip rows. */
  fingerprintsToImport?: string[];
}): Promise<ActionResult & { batchId?: string; created?: number }> {
  const { budget, session } = await requireBudgetAccess();
  const link = await prisma.bankAccountLink.findFirst({
    where: { id: params.linkId, connection: { budgetId: budget.id } },
    include: { connection: true },
  });
  if (!link?.financeAccountId || !link.connection.connectionId) {
    return { ok: false, error: "Link or Salt Edge connection missing" };
  }
  const accountId = link.financeAccountId;

  const preview = await previewSaltEdgeSync(params.linkId);
  if (!preview.ok) return preview;

  const allow =
    params.fingerprintsToImport && params.fingerprintsToImport.length > 0
      ? new Set(params.fingerprintsToImport)
      : null;

  const batch = await prisma.importBatch.create({
    data: {
      budgetId: budget.id,
      accountId,
      sourceLabel: "saltedge",
      createdById: session.user?.id ?? null,
    },
  });

  try {
    const snap = createDbSnapshot(batch.id);
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { snapshotPath: snap.relativePath },
    });
  } catch (e) {
    await prisma.importBatch.delete({ where: { id: batch.id } });
    return {
      ok: false,
      error:
        e instanceof Error
          ? `Snapshot failed: ${e.message}`
          : "Snapshot failed",
    };
  }

  const existing = await prisma.transaction.findMany({
    where: {
      accountId,
      OR: [
        {
          importFingerprint: {
            in: preview.rows.map((r) => r.fingerprint),
          },
        },
        {
          providerTransactionId: {
            in: preview.rows.map((r) => r.providerTransactionId),
          },
        },
      ],
    },
    select: {
      id: true,
      importFingerprint: true,
      providerTransactionId: true,
    },
  });
  const existingByFp = new Map(
    existing
      .filter((e) => e.importFingerprint)
      .map((e) => [e.importFingerprint as string, e.id]),
  );
  const existingByProvider = new Map(
    existing
      .filter((e) => e.providerTransactionId)
      .map((e) => [e.providerTransactionId as string, e.id]),
  );

  let created = 0;
  let skipped = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of preview.rows) {
      if (allow && !allow.has(row.fingerprint)) {
        skipped++;
        continue;
      }
      const plan = planIngConfirmAction({
        ignored: row.ignored,
        fingerprint: row.fingerprint,
        fingerprintAlreadyOnAccount:
          existingByFp.has(row.fingerprint) ||
          existingByProvider.has(row.providerTransactionId),
        decision: { fingerprint: row.fingerprint, action: "import" },
      });
      if (plan.kind !== "create") {
        skipped++;
        await tx.importBatchItem.create({
          data: {
            batchId: batch.id,
            action: "skipped_duplicate",
            fingerprint: row.fingerprint,
            memoPreview: row.memo.slice(0, 160),
            classification: "duplicate",
            transactionId:
              existingByFp.get(row.fingerprint) ??
              existingByProvider.get(row.providerTransactionId) ??
              null,
          },
        });
        continue;
      }

      let payeeId: string | null = null;
      const payeeName = row.payeeGuess?.trim();
      if (payeeName && payeeName !== "Unknown") {
        const existingPayee = await tx.payee.findFirst({
          where: { budgetId: budget.id, name: payeeName },
        });
        if (existingPayee) payeeId = existingPayee.id;
        else {
          const createdPayee = await tx.payee.create({
            data: { budgetId: budget.id, name: payeeName },
          });
          payeeId = createdPayee.id;
        }
      }

      const txn = await tx.transaction.create({
        data: {
          accountId,
          date: row.date,
          amount: row.amount,
          payeeId,
          categoryId: row.ignored ? null : row.categoryId,
          notes: row.memo,
          cleared: !row.pending,
          importFingerprint: row.fingerprint,
          importContentHash: row.contentHash,
          providerTransactionId: row.providerTransactionId,
          importBatchId: batch.id,
        },
      });
      created++;
      existingByFp.set(row.fingerprint, txn.id);
      existingByProvider.set(row.providerTransactionId, txn.id);
      await tx.importBatchItem.create({
        data: {
          batchId: batch.id,
          action: "created",
          transactionId: txn.id,
          fingerprint: row.fingerprint,
          memoPreview: row.memo.slice(0, 160),
          importRuleId: row.matchedRuleId,
          classification: row.ignored
            ? "rule_ignore"
            : row.categoryId
              ? "rule_category"
              : "unmatched",
        },
      });
    }

    await tx.importBatch.update({
      where: { id: batch.id },
      data: {
        statsJson: JSON.stringify({ created, skipped, source: "saltedge" }),
      },
    });
  });

  await prisma.bankProviderConnection.update({
    where: { id: link.connectionId },
    data: { lastSyncedAt: new Date(), status: "active", lastError: null },
  });

  await invalidateBudgetCaches(budget.id);
  revalidatePath("/more/bank-connections");
  revalidatePath("/more/import-history");
  revalidatePath("/transactions");
  revalidatePath("/plan");

  return { ok: true, batchId: batch.id, created };
}
