/**
 * Google OAuth env vars — Auth.js accepts AUTH_GOOGLE_*; many tutorials use GOOGLE_CLIENT_*.
 * Both are supported so `client_id` is never sent empty to Google by mistake.
 */
export function getGoogleClientId(): string | undefined {
  const id =
    process.env.AUTH_GOOGLE_ID?.trim() ||
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    "";
  return id || undefined;
}

export function getGoogleClientSecret(): string | undefined {
  const s =
    process.env.AUTH_GOOGLE_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    "";
  return s || undefined;
}

export function isGoogleOAuthConfigured(): boolean {
  return !!(getGoogleClientId() && getGoogleClientSecret());
}
