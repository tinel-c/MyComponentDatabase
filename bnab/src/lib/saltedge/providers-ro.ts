/**
 * Romania-focused provider hints for Salt Edge Connect.
 * Exact `provider_code` values come from Salt Edge providers API after LIVE;
 * codes below are searchable labels / expected codes used in UI filters.
 */

export type RoProviderHint = {
  /** Display name */
  name: string;
  /** Preferred provider_code when known; null until confirmed from providers list */
  code: string | null;
  country: "RO";
  priority: number;
};

export const ROMANIA_PROVIDER_HINTS: RoProviderHint[] = [
  { name: "ING", code: null, country: "RO", priority: 1 },
  { name: "Banca Transilvania", code: null, country: "RO", priority: 2 },
  { name: "BCR", code: null, country: "RO", priority: 3 },
  { name: "BRD", code: null, country: "RO", priority: 4 },
  { name: "Raiffeisen", code: null, country: "RO", priority: 5 },
];

/** Mandatory fake banks for Salt Edge LIVE validation checklist. */
export const SALTEDGE_MANDATORY_FAKE_CODES = [
  "fake_oauth_client_xf",
  "fake_client_xf",
] as const;

export function isMandatoryFakeProvider(code: string): boolean {
  return (SALTEDGE_MANDATORY_FAKE_CODES as readonly string[]).includes(code);
}
