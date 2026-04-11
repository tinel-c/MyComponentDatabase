import { createHash } from "crypto";

/**
 * Gravatar image URL for an email (MD5 hash of trimmed lowercase email).
 * @see https://docs.gravatar.com/api/avatars/images/
 */
export function getGravatarUrl(
  email: string | null | undefined,
  options?: { size?: number; defaultImage?: "identicon" | "mp" | "retro" | "robohash" },
): string {
  const normalized = (email ?? "").trim().toLowerCase();
  const hash = createHash("md5").update(normalized).digest("hex");
  const size = options?.size ?? 80;
  const d = options?.defaultImage ?? "identicon";
  const params = new URLSearchParams({ s: String(size), d });
  return `https://www.gravatar.com/avatar/${hash}?${params.toString()}`;
}
