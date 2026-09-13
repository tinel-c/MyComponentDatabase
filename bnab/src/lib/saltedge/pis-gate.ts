/**
 * Phase 4 Payment Initiation gate.
 * AIS is the default product path. PIS stays disabled until product + legal
 * approval is recorded (see docs/salt-edge-open-banking.md § Phase 4).
 */

export class PisNotEnabledError extends Error {
  constructor(message = "Salt Edge Payment Initiation is not enabled") {
    super(message);
    this.name = "PisNotEnabledError";
  }
}

export function isPisEnabled(): boolean {
  return process.env.SALTEDGE_PIS_ENABLED?.trim().toLowerCase() === "true";
}

/** Call before any PIS API usage. Throws unless explicitly enabled. */
export function assertPisAllowed(): void {
  if (!isPisEnabled()) {
    throw new PisNotEnabledError(
      "Payment Initiation blocked by Phase 4 decision gate. Set SALTEDGE_PIS_ENABLED=true only after ADR/product approval (docs/salt-edge-open-banking.md).",
    );
  }
}
