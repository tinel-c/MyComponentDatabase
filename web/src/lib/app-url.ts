import { headers } from "next/headers";

/** Base URL for absolute links and QR codes (uses request host in dev, AUTH_URL fallback). */
export async function getAppBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) {
    return `${proto}://${host}`;
  }
  const fromEnv = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}
