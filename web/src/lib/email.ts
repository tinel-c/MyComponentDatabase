/** Normalize email for storage and lookup (Google may vary casing). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
