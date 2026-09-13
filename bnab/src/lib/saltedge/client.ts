import { createSign, createVerify, createPrivateKey } from "node:crypto";
import { readFileSync } from "node:fs";

/** Salt Edge Open Banking Gateway API v6 (Partners + Client). */
const API_BASE = "https://www.saltedge.com/api/v6";

export type SaltEdgeConfig = {
  appId: string;
  secret: string;
  privateKeyPem: string | null;
  returnTo: string;
};

export function loadSaltEdgeConfig(): SaltEdgeConfig | null {
  const appId = process.env.SALTEDGE_APP_ID?.trim();
  const secret = process.env.SALTEDGE_SECRET?.trim();
  if (!appId || !secret) return null;

  let privateKeyPem: string | null =
    process.env.SALTEDGE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim() || null;
  const keyPath = process.env.SALTEDGE_PRIVATE_KEY_PATH?.trim();
  if (!privateKeyPem && keyPath) {
    try {
      privateKeyPem = readFileSync(keyPath, "utf8");
    } catch {
      privateKeyPem = null;
    }
  }

  const authUrl = (process.env.AUTH_URL ?? "http://localhost:3010").replace(
    /\/$/,
    "",
  );
  const returnTo =
    process.env.SALTEDGE_RETURN_TO?.trim() ||
    `${authUrl}/more/bank-connections`;

  return { appId, secret, privateKeyPem, returnTo };
}

export function isSaltEdgeConfigured(): boolean {
  return loadSaltEdgeConfig() != null;
}

/** Sign request body for LIVE mode: Expires-at|METHOD|url|body */
export function signSaltEdgeRequest(params: {
  privateKeyPem: string;
  expiresAt: number;
  method: string;
  url: string;
  body: string;
}): string {
  const payload = `${params.expiresAt}|${params.method.toUpperCase()}|${params.url}|${params.body}`;
  const key = createPrivateKey(params.privateKeyPem);
  const signer = createSign("RSA-SHA256");
  signer.update(payload);
  signer.end();
  return signer.sign(key, "base64");
}

export class SaltEdgeApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: unknown,
  ) {
    super(message);
    this.name = "SaltEdgeApiError";
  }
}

async function apiRequest<T>(
  method: string,
  path: string,
  bodyObj?: unknown,
): Promise<T> {
  const cfg = loadSaltEdgeConfig();
  if (!cfg) {
    throw new SaltEdgeApiError("Salt Edge is not configured", 503, null);
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const body = bodyObj == null ? "" : JSON.stringify(bodyObj);
  const expiresAt = Math.floor(Date.now() / 1000) + 60;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "App-id": cfg.appId,
    Secret: cfg.secret,
    "Expires-at": String(expiresAt),
  };

  if (cfg.privateKeyPem) {
    headers.Signature = signSaltEdgeRequest({
      privateKeyPem: cfg.privateKeyPem,
      expiresAt,
      method,
      url,
      body,
    });
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body || undefined,
    cache: "no-store",
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const errMsg =
      typeof json === "object" &&
      json &&
      "error" in json &&
      typeof (json as { error?: { message?: string } }).error?.message ===
        "string"
        ? (json as { error: { message: string } }).error.message
        : `Salt Edge HTTP ${res.status}`;
    throw new SaltEdgeApiError(errMsg, res.status, json);
  }

  return json as T;
}

export type SaltEdgeCustomer = {
  customer_id: string;
  identifier?: string;
  email?: string;
};

/** @deprecated Use SaltEdgeCustomer — kept for call-site compatibility. */
export type SaltEdgeLead = SaltEdgeCustomer & { email: string };

export type SaltEdgeConnection = {
  id: string;
  secret?: string;
  provider_code?: string;
  provider_name?: string;
  status?: string;
  consent?: { expires_at?: string | null } | null;
  next_refresh_possible_at?: string | null;
};

export type SaltEdgeAccount = {
  id: string;
  name?: string;
  nature?: string;
  currency_code?: string;
  balance?: number;
  connection_id?: string;
};

export type SaltEdgeTransaction = {
  id: string;
  account_id: string;
  made_on?: string;
  amount?: number;
  currency_code?: string;
  description?: string;
  status?: string;
  category?: string;
  extra?: Record<string, unknown> | null;
};

type Wrap<T> = { data: T; meta?: Record<string, unknown> };

export async function listCustomers(params?: {
  fromId?: string;
}): Promise<{ data: SaltEdgeCustomer[]; nextId: string | null }> {
  const q = new URLSearchParams();
  if (params?.fromId) q.set("from_id", params.fromId);
  const suffix = q.toString() ? `?${q}` : "";
  const res = await apiRequest<
    Wrap<SaltEdgeCustomer[]> & {
      meta?: { next_id?: string | null; next_page?: string | null };
    }
  >("GET", `/customers${suffix}`);
  const data = Array.isArray(res.data) ? res.data : [];
  let nextId: string | null = null;
  if (res.meta && typeof res.meta.next_id === "string") {
    nextId = res.meta.next_id;
  } else if (data.length > 0) {
    // Fallback: if more pages exist Salt Edge often returns next_page; use last id.
    const nextPage =
      res.meta && typeof res.meta.next_page === "string"
        ? res.meta.next_page
        : null;
    if (nextPage) {
      const m = nextPage.match(/from_id=([^&]+)/);
      nextId = m ? decodeURIComponent(m[1]) : data[data.length - 1]!.customer_id;
    }
  }
  return { data, nextId };
}

export async function findCustomerByIdentifier(
  identifier: string,
): Promise<SaltEdgeCustomer | null> {
  const want = identifier.trim().toLowerCase();
  let fromId: string | undefined;
  for (let page = 0; page < 50; page++) {
    const batch = await listCustomers({ fromId });
    const hit = batch.data.find(
      (c) => (c.identifier ?? "").trim().toLowerCase() === want,
    );
    if (hit) return hit;
    if (!batch.nextId || batch.data.length === 0) break;
    fromId = batch.nextId;
  }
  return null;
}

/**
 * Create (or reclaim) a v6 Customer. Identifier is stable per end-user email.
 * On DuplicatedCustomer, looks up the existing customer by identifier.
 */
export async function createCustomer(
  identifier: string,
): Promise<SaltEdgeCustomer> {
  const id = identifier.trim().toLowerCase();
  try {
    const res = await apiRequest<Wrap<SaltEdgeCustomer>>("POST", "/customers", {
      data: { identifier: id },
    });
    return res.data;
  } catch (e) {
    if (
      e instanceof SaltEdgeApiError &&
      typeof e.body === "object" &&
      e.body &&
      "error" in e.body
    ) {
      const errClass = (e.body as { error?: { class?: string } }).error?.class;
      if (errClass === "DuplicatedCustomer") {
        const existing = await findCustomerByIdentifier(id);
        if (existing?.customer_id) return existing;
      }
    }
    throw e;
  }
}

/** Compatibility wrapper: Partners "lead" → v6 customer. */
export async function createLead(email: string): Promise<SaltEdgeLead> {
  const customer = await createCustomer(email.trim().toLowerCase());
  return {
    customer_id: customer.customer_id,
    identifier: customer.identifier,
    email,
  };
}

function defaultConsent(consentDays = 90) {
  return {
    scopes: ["accounts", "transactions"],
    from_date: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
    period_days: consentDays,
  };
}

function defaultAttempt(returnTo: string) {
  return {
    return_to: returnTo,
    fetch_scopes: ["accounts", "transactions"],
  };
}

export async function createConnectSession(params: {
  customerId: string;
  providerCode?: string;
  consentDays?: number;
  returnTo?: string;
}): Promise<{ connect_url: string; expires_at?: string }> {
  const cfg = loadSaltEdgeConfig();
  const returnTo = params.returnTo ?? cfg?.returnTo ?? "";
  const data: Record<string, unknown> = {
    customer_id: params.customerId,
    consent: defaultConsent(params.consentDays ?? 90),
    attempt: defaultAttempt(returnTo),
  };
  if (params.providerCode) {
    data.provider_code = params.providerCode;
  }
  const res = await apiRequest<
    Wrap<{ connect_url: string; expires_at?: string }>
  >("POST", "/connections/connect", { data });
  return res.data;
}

/** @deprecated Use createConnectSession */
export async function createLeadSession(params: {
  customerId: string;
  providerCode?: string;
  consentDays?: number;
  returnTo?: string;
}): Promise<{ redirect_url: string; expires_at?: string }> {
  const session = await createConnectSession(params);
  return {
    redirect_url: session.connect_url,
    expires_at: session.expires_at,
  };
}

export async function createReconnectSession(params: {
  connectionId: string;
  returnTo?: string;
  consentDays?: number;
}): Promise<{ redirect_url: string }> {
  const cfg = loadSaltEdgeConfig();
  const res = await apiRequest<Wrap<{ connect_url: string }>>(
    "POST",
    `/connections/${params.connectionId}/reconnect`,
    {
      data: {
        consent: defaultConsent(params.consentDays ?? 90),
        attempt: defaultAttempt(params.returnTo ?? cfg?.returnTo ?? ""),
      },
    },
  );
  return { redirect_url: res.data.connect_url };
}

export async function refreshConnection(
  connectionId: string,
): Promise<SaltEdgeConnection> {
  const res = await apiRequest<Wrap<SaltEdgeConnection>>(
    "POST",
    `/connections/${connectionId}/background_refresh`,
    {
      data: {
        attempt: {
          fetch_scopes: ["accounts", "transactions"],
        },
      },
    },
  );
  return res.data;
}

/**
 * Widget refresh session — use when background refresh is rate-limited or
 * requires interaction. Returns connect_url like reconnect.
 */
export async function createRefreshSession(params: {
  connectionId: string;
  returnTo?: string;
  consentDays?: number;
}): Promise<{ redirect_url: string; expires_at?: string }> {
  const cfg = loadSaltEdgeConfig();
  const res = await apiRequest<
    Wrap<{ connect_url: string; expires_at?: string }>
  >("POST", `/connections/${params.connectionId}/refresh`, {
    data: {
      // Partners / some providers require consent on widget refresh too.
      consent: defaultConsent(params.consentDays ?? 90),
      attempt: defaultAttempt(params.returnTo ?? cfg?.returnTo ?? ""),
    },
  });
  return {
    redirect_url: res.data.connect_url,
    expires_at: res.data.expires_at,
  };
}

export async function showConnection(
  connectionId: string,
): Promise<SaltEdgeConnection> {
  const res = await apiRequest<Wrap<SaltEdgeConnection>>(
    "GET",
    `/connections/${connectionId}`,
  );
  return res.data;
}

export async function listConnections(
  customerId: string,
): Promise<SaltEdgeConnection[]> {
  const res = await apiRequest<Wrap<SaltEdgeConnection[]>>(
    "GET",
    `/connections?customer_id=${encodeURIComponent(customerId)}`,
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function listAccounts(
  connectionId: string,
): Promise<SaltEdgeAccount[]> {
  const res = await apiRequest<Wrap<SaltEdgeAccount[]>>(
    "GET",
    `/accounts?connection_id=${encodeURIComponent(connectionId)}`,
  );
  return Array.isArray(res.data) ? res.data : [];
}

export async function listTransactions(params: {
  connectionId: string;
  accountId?: string;
  fromId?: string;
}): Promise<{ data: SaltEdgeTransaction[]; nextId: string | null }> {
  const q = new URLSearchParams({
    connection_id: params.connectionId,
  });
  if (params.accountId) q.set("account_id", params.accountId);
  if (params.fromId) q.set("from_id", params.fromId);
  const res = await apiRequest<
    Wrap<SaltEdgeTransaction[]> & { meta?: { next_id?: string | null } }
  >("GET", `/transactions?${q.toString()}`);
  const data = Array.isArray(res.data) ? res.data : [];
  const nextId =
    res.meta && typeof res.meta.next_id === "string" ? res.meta.next_id : null;
  return { data, nextId };
}

export async function listAllTransactions(params: {
  connectionId: string;
  accountId?: string;
  maxPages?: number;
}): Promise<SaltEdgeTransaction[]> {
  const out: SaltEdgeTransaction[] = [];
  let fromId: string | undefined;
  const maxPages = params.maxPages ?? 50;
  for (let i = 0; i < maxPages; i++) {
    const page = await listTransactions({
      connectionId: params.connectionId,
      accountId: params.accountId,
      fromId,
    });
    out.push(...page.data);
    if (!page.nextId || page.data.length === 0) break;
    fromId = page.nextId;
  }
  return out;
}

export async function removeConnection(connectionId: string): Promise<void> {
  await apiRequest("DELETE", `/connections/${connectionId}`);
}

/** Verify Salt Edge → BNAB callback Signature header. */
export function verifyCallbackSignature(params: {
  callbackUrl: string;
  body: string;
  signatureBase64: string;
  publicKeyPem: string;
}): boolean {
  try {
    const payload = `${params.callbackUrl}|${params.body}`;
    const verifier = createVerify("RSA-SHA256");
    verifier.update(payload);
    verifier.end();
    return verifier.verify(params.publicKeyPem, params.signatureBase64, "base64");
  } catch {
    return false;
  }
}
