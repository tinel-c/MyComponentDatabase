import { prisma } from "@/lib/prisma";
import {
  getCallbackPublicKey,
  listAccounts,
  showConnection,
  verifyCallbackSignature,
} from "@/lib/saltedge";

export type CallbackKind =
  | "success"
  | "fail"
  | "notify"
  | "destroy"
  | "provider-changes";

export async function handleSaltEdgeCallback(params: {
  kind: CallbackKind;
  requestUrl: string;
  rawBody: string;
  signature: string | null;
}): Promise<{ ok: boolean; status: number; detail?: string }> {
  const publicKey = getCallbackPublicKey();
  if (params.signature) {
    const valid = verifyCallbackSignature({
      callbackUrl: params.requestUrl,
      body: params.rawBody,
      signatureBase64: params.signature,
      publicKeyPem: publicKey,
    });
    if (!valid) {
      return { ok: false, status: 401, detail: "invalid_signature" };
    }
  } else if (process.env.NODE_ENV === "production") {
    return { ok: false, status: 401, detail: "missing_signature" };
  }

  let parsed: {
    data?: {
      connection_id?: string;
      customer_id?: string;
      error_class?: string;
      error_message?: string;
      stage?: string;
    };
  };
  try {
    parsed = JSON.parse(params.rawBody) as typeof parsed;
  } catch {
    return { ok: false, status: 400, detail: "invalid_json" };
  }

  const connectionId = parsed.data?.connection_id?.trim() || null;
  const customerId = parsed.data?.customer_id?.trim() || null;

  if (params.kind === "destroy" && connectionId) {
    await prisma.bankProviderConnection.updateMany({
      where: { connectionId },
      data: {
        status: "destroyed",
        lastError: null,
        updatedAt: new Date(),
      },
    });
    return { ok: true, status: 200 };
  }

  if (params.kind === "fail" && connectionId) {
    const msg =
      parsed.data?.error_message ||
      parsed.data?.error_class ||
      "Salt Edge fail callback";
    await prisma.bankProviderConnection.updateMany({
      where: { connectionId },
      data: { status: "error", lastError: msg, updatedAt: new Date() },
    });
    return { ok: true, status: 200 };
  }

  if (
    (params.kind === "success" || params.kind === "notify") &&
    connectionId
  ) {
    await upsertConnectionFromCallback({
      connectionId,
      customerId,
      stage: parsed.data?.stage ?? null,
    });
    return { ok: true, status: 200 };
  }

  // provider-changes: acknowledge only
  return { ok: true, status: 200 };
}

async function upsertConnectionFromCallback(params: {
  connectionId: string;
  customerId: string | null;
  stage: string | null;
}) {
  let remote;
  try {
    remote = await showConnection(params.connectionId);
  } catch {
    remote = null;
  }

  const existing = await prisma.bankProviderConnection.findFirst({
    where: { connectionId: params.connectionId },
  });

  const consentRaw = remote?.consent?.expires_at;
  const consentExpiresAt = consentRaw ? new Date(consentRaw) : null;
  const status =
    params.stage === "finish"
      ? "active"
      : (remote?.status ?? existing?.status ?? "fetching");

  let row = existing;
  if (!row && params.customerId) {
    row = await prisma.bankProviderConnection.findFirst({
      where: {
        leadId: params.customerId,
        OR: [{ connectionId: null }, { connectionId: params.connectionId }],
      },
      orderBy: { createdAt: "desc" },
    });
  }

  if (row) {
    await prisma.bankProviderConnection.update({
      where: { id: row.id },
      data: {
        connectionId: params.connectionId,
        leadId: params.customerId ?? row.leadId,
        providerCode: remote?.provider_code ?? row.providerCode,
        providerName: remote?.provider_name ?? row.providerName,
        status,
        consentExpiresAt: consentExpiresAt ?? row.consentExpiresAt,
        lastError: null,
        lastSyncedAt: params.stage === "finish" ? new Date() : row.lastSyncedAt,
      },
    });
  } else if (params.customerId) {
    // Orphan callback — attach to any budget that already has this lead, else skip
    const byLead = await prisma.bankProviderConnection.findFirst({
      where: { leadId: params.customerId },
    });
    if (byLead) {
      await prisma.bankProviderConnection.create({
        data: {
          budgetId: byLead.budgetId,
          leadId: params.customerId,
          connectionId: params.connectionId,
          providerCode: remote?.provider_code ?? null,
          providerName: remote?.provider_name ?? null,
          status,
          consentExpiresAt,
        },
      });
      row = byLead;
    }
  }

  const connRow = await prisma.bankProviderConnection.findFirst({
    where: { connectionId: params.connectionId },
  });
  if (!connRow) return;

  try {
    const accounts = await listAccounts(params.connectionId);
    for (const acc of accounts) {
      const balanceMajor = Number(acc.balance);
      const balanceMinor = Number.isFinite(balanceMajor)
        ? Math.round(balanceMajor * 100)
        : null;
      await prisma.bankAccountLink.upsert({
        where: {
          connectionId_externalAccountId: {
            connectionId: connRow.id,
            externalAccountId: String(acc.id),
          },
        },
        create: {
          connectionId: connRow.id,
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
    // Accounts may not be ready on early success callbacks
  }
}
