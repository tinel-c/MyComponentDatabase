"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type InfiniteListProps<T> = {
  initialItems: T[];
  initialCursor: string | null;
  hasMore: boolean;
  loadMore: (cursor: string) => Promise<{
    items: T[];
    nextCursor: string | null;
    hasMore: boolean;
  }>;
  className?: string;
  endLabel?: string;
} & (
  | {
      /** Replace default ul/li rendering (e.g. TransactionsRegister table). */
      renderList: (items: T[]) => ReactNode;
      renderItem?: never;
      keyOf?: never;
    }
  | {
      renderList?: never;
      renderItem: (item: T, index: number) => ReactNode;
      keyOf: (item: T) => string;
    }
);

/**
 * Cursor infinite list: first chunk from RSC, further chunks via loadMore.
 */
export function InfiniteList<T>({
  initialItems,
  initialCursor,
  hasMore: initialHasMore,
  loadMore,
  className,
  endLabel = "End of list",
  renderList,
  renderItem,
  keyOf,
}: InfiniteListProps<T>) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    setItems(initialItems);
    setCursor(initialCursor);
    setHasMore(initialHasMore);
    setError(null);
  }, [initialItems, initialCursor, initialHasMore]);

  const fetchMore = useCallback(async () => {
    if (!hasMore || !cursor || busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await loadMore(cursor);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setLoading(false);
      busy.current = false;
    }
  }, [hasMore, cursor, loadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void fetchMore();
      },
      { rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [fetchMore, hasMore]);

  return (
    <div className={className}>
      {renderList != null ? (
        renderList(items)
      ) : (
        <ul className="divide-y divide-rim-subtle">
          {items.map((item, i) => (
            <li key={keyOf!(item)}>{renderItem!(item, i)}</li>
          ))}
        </ul>
      )}
      <div ref={sentinelRef} className="h-4" aria-hidden />
      <p className="py-3 text-center text-xs text-fg-muted" aria-live="polite">
        {loading ? "Loading…" : error ? error : hasMore ? null : endLabel}
      </p>
    </div>
  );
}
