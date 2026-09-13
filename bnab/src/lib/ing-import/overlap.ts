/**
 * Pure helpers for ING CSV rows overlapping with manual bill-import entries.
 * Keep DB / server actions thin; put matching + duplicate decisions here for tests.
 */

import { findManualMatch, memoMatchesImportRule } from "./parse";

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
  transferAccountId?: string | null;
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

/** Pending bill ledger row: stamped notes and not yet linked to a statement fingerprint. */
export function isPendingBillImportTxn(params: {
  notes: string | null | undefined;
  importFingerprint: string | null | undefined;
  isPendingBill?: boolean | null;
}): boolean {
  if (params.importFingerprint) return false;
  if (params.isPendingBill === true) return true;
  return isBillImportPendingNotes(params.notes);
}

/**
 * Classify one applied ING row against fingerprints already on the account and
 * unfingerprinted manual rows (including bill imports awaiting statement link).
 *
 * Ignore-rule matches still import into the ledger; they are labeled "ignored"
 * only to mean "excluded from budget math" (excludeFromRta via notes).
 */
export function classifyIngRowAgainstLedger(
  row: IngRowForStatus,
  existingFingerprints: ReadonlySet<string>,
  manuals: ManualLedgerTxn[],
): IngPreviewClassification {
  if (existingFingerprints.has(row.fingerprint)) {
    return { status: "already_imported", manualMatchId: null };
  }
  const manualMatchId = findManualMatch(row, manuals);
  if (manualMatchId) {
    // findManualMatch uses absolute amounts, which can pair credit-line covers
    // with debit bills. Ignore-rule rows may still link when signs agree.
    const manual = manuals.find((m) => m.id === manualMatchId);
    const sameSign =
      !manual ||
      manual.amount === 0 ||
      row.amount === 0 ||
      Math.sign(manual.amount) === Math.sign(row.amount);
    if (!row.ignored || sameSign) {
      return { status: "possible_manual_match", manualMatchId };
    }
  }
  if (row.ignored) {
    return { status: "ignored", manualMatchId: null };
  }
  if (row.transferAccountId || row.categoryId) {
    return { status: "new", manualMatchId: null };
  }
  return { status: "unmatched", manualMatchId: null };
}

export type ConfirmDecisionLike = {
  fingerprint: string;
  action: "import" | "skip" | "link" | "replace" | "import_anyway";
  manualMatchId?: string | null;
};

/**
 * Plan what confirmIngImport should do for one row — no DB side effects.
 * Ensures already-fingerprinted rows never create a second transaction.
 * Ignore-rule rows still create/link (budget exclusion is via notes + excludeFromRta).
 */
export function planIngConfirmAction(params: {
  ignored: boolean;
  fingerprint: string;
  fingerprintAlreadyOnAccount: boolean;
  decision?: ConfirmDecisionLike | null;
}):
  | { kind: "skip_duplicate" }
  | { kind: "skip_user" }
  | { kind: "link"; manualMatchId: string }
  | { kind: "replace_then_create"; manualMatchId: string }
  | { kind: "create" } {
  void params.ignored;
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

  // import / import_anyway (and ignored rows with no decision)
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
    .filter(
      (r) =>
        r.status === "new" ||
        r.status === "unmatched" ||
        r.status === "ignored",
    )
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

export type PreviewStats = {
  total: number;
  new: number;
  already: number;
  ignored: number;
  unmatched: number;
  manual: number;
};

/** Count statuses for a preview row list. */
export function previewStatsFromRows(
  rows: { status: IngPreviewStatus }[],
): PreviewStats {
  return {
    total: rows.length,
    new: rows.filter((r) => r.status === "new").length,
    already: rows.filter((r) => r.status === "already_imported").length,
    ignored: rows.filter((r) => r.status === "ignored").length,
    unmatched: rows.filter((r) => r.status === "unmatched").length,
    manual: rows.filter((r) => r.status === "possible_manual_match").length,
  };
}

type PreviewRuleApplyRow = {
  fingerprint: string;
  memo: string;
  status: IngPreviewStatus;
  ignored: boolean;
  categoryId: string | null;
  categoryName: string | null;
  transferAccountId?: string | null;
  transferAccountName?: string | null;
};

/**
 * After saving a mapping from "Create rules from unmatched", re-apply that
 * substring (anywhere in memo, case-insensitive) so sibling unmatched rows
 * leave the unmatched list without waiting for a full server round-trip.
 */
export function applyNewRuleToPreviewRows<T extends PreviewRuleApplyRow>(
  rows: T[],
  params: {
    matchText: string;
    ignore: boolean;
    categoryId: string | null;
    categoryName: string | null;
    transferAccountId?: string | null;
    transferAccountName?: string | null;
  },
): { rows: T[]; stats: PreviewStats; matchedFingerprints: string[] } {
  const needle = params.matchText.trim();
  const matchedFingerprints: string[] = [];
  const next = rows.map((r) => {
    if (!memoMatchesImportRule(r.memo, needle)) return r;
    matchedFingerprints.push(r.fingerprint);
    if (params.ignore) {
      return {
        ...r,
        ignored: true,
        categoryId: null,
        categoryName: null,
        transferAccountId: null,
        transferAccountName: null,
        status:
          r.status === "already_imported" ||
          r.status === "possible_manual_match"
            ? r.status
            : ("ignored" as const),
      };
    }
    if (params.transferAccountId) {
      return {
        ...r,
        ignored: false,
        categoryId: params.categoryId,
        categoryName: params.categoryName,
        transferAccountId: params.transferAccountId,
        transferAccountName: params.transferAccountName ?? null,
        status:
          r.status === "already_imported" ||
          r.status === "possible_manual_match"
            ? r.status
            : ("new" as const),
      };
    }
    return {
      ...r,
      ignored: false,
      categoryId: params.categoryId,
      categoryName: params.categoryName,
      transferAccountId: null,
      transferAccountName: null,
      status:
        r.status === "already_imported" ||
        r.status === "possible_manual_match"
          ? r.status
          : ("new" as const),
    };
  });
  return {
    rows: next,
    stats: previewStatsFromRows(next),
    matchedFingerprints,
  };
}
