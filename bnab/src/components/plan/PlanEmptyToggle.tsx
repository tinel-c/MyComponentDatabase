"use client";

import { useState, type ReactNode } from "react";

/** Isolates show-empty toggle so PlanCategoryList can stay a Server Component. */
export function PlanEmptyToggle({
  emptyCount,
  children,
}: {
  emptyCount: number;
  children: ReactNode;
}) {
  const [showEmpty, setShowEmpty] = useState(false);

  return (
    <div data-show-empty={showEmpty ? "1" : "0"} className="group/plan-empty">
      {children}
      {emptyCount > 0 ? (
        <button
          type="button"
          className="w-full border-t border-rim-subtle/60 px-3 py-2 text-center text-xs font-medium text-fg-muted transition-colors hover:bg-overlay/40 hover:text-fg md:hidden"
          onClick={() => setShowEmpty((v) => !v)}
        >
          {showEmpty
            ? "Hide empty categories"
            : `Show ${emptyCount} empty categor${emptyCount === 1 ? "y" : "ies"}`}
        </button>
      ) : null}
    </div>
  );
}
