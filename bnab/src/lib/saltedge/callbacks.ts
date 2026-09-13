/**
 * Salt Edge Partners callback public key (Signature-key-version 5.0).
 * Source: https://docs.saltedge.com/partners/v1/ — Callbacks → Signature
 */
export const SALTEDGE_CALLBACK_PUBLIC_KEY_V5 = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvL/Xxdmj7/cpZgvDMvxr
nTTU/vkHGM/qkJ0Q+rmfYLru0Z/rSWthPDEK3orY5BTa0sAe2wUV5Fes677X6+Ib
roCF8nODW5hSVTrqWcrQ55I7InpFkpTxyMkiFN8XPS7qmYXl/xofbYq0olcwE/aw
9lfHlZD7iwOpVJqTsYiXzSMRu92ZdECV895kYS/ggymSEtoMSW3405dQ6OfnK53x
7AJPdkAp0Wa2Lk4BNBMd24uu2tasO1bTYBsHpxonwbA+o8BXffdTEloloJgW7pV+
TWvxB/Uxil4yhZZJaFmvTCefxWFovyzLdjn2aSAEI7D1y4IYOdByMOPYQ6Mn7J9A
9wIDAQAB
-----END PUBLIC KEY-----`;

/** Override via SALTEDGE_CALLBACK_PUBLIC_KEY when Salt Edge rotates keys. */
export function getCallbackPublicKey(): string {
  const fromEnv = process.env.SALTEDGE_CALLBACK_PUBLIC_KEY?.replace(
    /\\n/g,
    "\n",
  )?.trim();
  if (fromEnv) return fromEnv;
  return SALTEDGE_CALLBACK_PUBLIC_KEY_V5;
}

export function isCallbackPublicKeyConfigured(): boolean {
  return Boolean(getCallbackPublicKey());
}
