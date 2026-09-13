import type { ReactNode } from "react";
import Link from "next/link";

/** Wraps category rows; empty visibility comes from URL `empty=0|1`. */
export function PlanEmptyToggle({
  showEmpty,
  emptyCount,
  showEmptyHref,
  hideEmptyHref,
  children,
}: {
  showEmpty: boolean;
  emptyCount: number;
  showEmptyHref: string;
  hideEmptyHref: string;
  children: ReactNode;
}) {
  return (
    <div data-show-empty={showEmpty ? "1" : "0"} className="group/plan-empty">
      {children}
      {emptyCount > 0 ? (
        <Link
          href={showEmpty ? hideEmptyHref : showEmptyHref}
          className="block w-full border-t border-rim-subtle/60 px-3 py-2 text-center text-xs font-medium text-fg-muted transition-colors hover:bg-overlay/40 hover:text-fg md:hidden"
          scroll={false}
        >
          {showEmpty
            ? "Hide empty categories"
            : `Show ${emptyCount} empty categor${emptyCount === 1 ? "y" : "ies"}`}
        </Link>
      ) : null}
    </div>
  );
}
