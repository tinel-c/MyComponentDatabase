import { timingSafeEqual } from "node:crypto";

export function getBearerToken(request: Request): string | null {
  const h = request.headers.get("authorization");
  if (!h || !/^Bearer\s+/i.test(h)) return null;
  return h.replace(/^Bearer\s+/i, "").trim();
}

/** Compare `DATABASE_SYNC_SECRET` to the Bearer token using a timing-safe comparison. */
export function verifySyncSecret(token: string | null): boolean {
  const secret = process.env.DATABASE_SYNC_SECRET?.trim();
  if (!secret || token == null || token === "") return false;
  try {
    const a = Buffer.from(secret, "utf8");
    const b = Buffer.from(token, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
