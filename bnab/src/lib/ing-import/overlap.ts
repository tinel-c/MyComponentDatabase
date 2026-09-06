/**
 * Pure helpers for ING CSV rows overlapping with manual bill-import entries.
 * Keep DB / server actions thin; put matching + duplicate decisions here for tests.
 */

import { findManualMatch } from "./parse";

/** Notes prefix stamped on transactions created from bill scans before ING arrives. */
export const BILL_IMPORT_PENDING_NOTE = "Bill import · pending statement";

export type ManualLedgerTxn = {
  id: string;
  date: string;
  amount: number;
  notes: string | null;
  payeeName?: string | null;
};

export type IngRowForStatus = {
  date: string;
  amount: number;
  memo?: string;
  fingerprint: string;
  ignored: boolean;
  categoryId: string | null;
};

export type IngPreviewStatus =
  | "new"
  | "already_imported"
  | "ignored"
  | "unmatched"
  | "possible_manual_match";

export type IngPreviewClassification = {
  status: IngPreviewStatus;
  manualMatchId: string | null;
};

export function isBillImportPendingNotes(notes: string | null | undefined): boolean {
  if (!notes) return false;
  return notes.toLowerCase().includes("bill import");
}

/**
 * Classify one applied ING row against fingerprints already on the account and
 * unfingerprinted manual rows (including bill imports awaiting statement link).
 */
export function classifyIngRowAgainstLedger(
  row: IngRowForStatus,
  existingFingerprints: ReadonlySet<string>,
  manuals: ManualLedgerTxn[],
): IngPreviewClassification {
  if (row.ignored) {
    return { status: "ignored", manualMatchId: null };
  }
  if (existingFingerprints.has(row.fingerprint)) {
    return { status: "already_imported", manualMatchId: null };
  }
  const manualMatchId = findManualMatch(row, manuals);
  if (manualMatchId) {
    return { status: "possible_manual_match", manualMatchId };
  }
  if (!row.categoryId) {
    return { status: "unmatched", manualMatchId: null };
  }
  return { status: "new", manualMatchId: null };
}

export type ConfirmDecisionLike = {
  fingerprint: string;
  action: "import" | "skip" | "link" | "replace" | "import_anyway";
  manualMatchId?: string | null;
};

/**
 * Plan what confirmIngImport should do for one row — no DB side effects.
 * Ensures already-fingerprinted rows never create a second transaction.
 */
export function planIngConfirmAction(params: {
  ignored: boolean;
  fingerprint: string;
  fingerprintAlreadyOnAccount: boolean;
  decision?: ConfirmDecisionLike | null;
}):
  | { kind: "ignored" }
  | { kind: "skip_duplicate" }
  | { kind: "skip_user" }
  | { kind: "link"; manualMatchId: string }
  | { kind: "replace_then_create"; manualMatchId: string }
  | { kind: "create" } {
  if (params.ignored) return { kind: "ignored" };
  if (params.fingerprintAlreadyOnAccount) return { kind: "skip_duplicate" };

  const decision = params.decision;
  const action = decision?.action ?? "import";

  if (action === "skip") return { kind: "skip_user" };

  if (action === "link") {
    const id = decision?.manualMatchId?.trim();
    if (id) return { kind: "link", manualMatchId: id };
    // Bad / missing link target — fall through to create would duplicate spend.
    // Prefer skip so overlapping bill+ING never silently doubles.
    return { kind: "skip_user" };
  }

  if (action === "replace") {
    const id = decision?.manualMatchId?.trim();
    if (id) return { kind: "replace_then_create", manualMatchId: id };
    return { kind: "create" };
  }

  // import / import_anyway
  return { kind: "create" };
}

/**
 * Simulate a full preview pass: which ING rows would create new txns vs link/skip.
 * Used by regression tests; mirrors previewIngImport status assignment.
 */
export function classifyIngImportPreview(params: {
  rows: IngRowForStatus[];
  existingFingerprints: ReadonlySet<string>;
  manuals: ManualLedgerTxn[];
}): {
  rows: (IngRowForStatus & IngPreviewClassification)[];
  stats: {
    total: number;
    new: number;
    already: number;
    ignored: number;
    unmatched: number;
    manual: number;
  };
  /** Fingerprints that would create a brand-new register row if imported as "import". */
  wouldCreateFingerprints: string[];
} {
  const classified = params.rows.map((row) => {
    const c = classifyIngRowAgainstLedger(
      row,
      params.existingFingerprints,
      params.manuals,
    );
    return { ...row, ...c };
  });

  const wouldCreateFingerprints = classified
    .filter((r) => r.status === "new" || r.status === "unmatched")
    .map((r) => r.fingerprint);

  return {
    rows: classified,
    stats: {
      total: classified.length,
      new: classified.filter((r) => r.status === "new").length,
      already: classified.filter((r) => r.status === "already_imported").length,
      ignored: classified.filter((r) => r.status === "ignored").length,
      unmatched: classified.filter((r) => r.status === "unmatched").length,
      manual: classified.filter((r) => r.status === "possible_manual_match")
        .length,
    },
    wouldCreateFingerprints,
  };
}
