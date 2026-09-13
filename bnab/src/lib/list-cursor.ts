/**
 * Cursor helpers for infinite lists.
 * Cursor format: `${date}|${id}` (lexicographic with orderBy date desc, id desc).
 * For createdAt lists, encode ISO timestamp in the date slot.
 */

export const LIST_PAGE_SIZE = 50;

export function encodeListCursor(date: string, id: string): string {
  return `${date}|${id}`;
}

export function decodeListCursor(
  cursor: string | null | undefined,
): { date: string; id: string } | null {
  if (!cursor) return null;
  const i = cursor.indexOf("|");
  if (i <= 0) return null;
  return { date: cursor.slice(0, i), id: cursor.slice(i + 1) };
}

export function nextCursorFromRows<T extends { date: string; id: string }>(
  rows: T[],
  take: number,
): { nextCursor: string | null; hasMore: boolean } {
  if (rows.length < take) return { nextCursor: null, hasMore: false };
  const last = rows[rows.length - 1]!;
  return {
    nextCursor: encodeListCursor(last.date, last.id),
    hasMore: true,
  };
}

/** Prisma OR branch for orderBy date desc, id desc. */
export function dateIdCursorOr(c: { date: string; id: string }) {
  return [
    { date: { lt: c.date } },
    { AND: [{ date: c.date }, { id: { lt: c.id } }] },
  ];
}

/** Prisma OR branch for orderBy createdAt desc, id desc (date slot = ISO). */
export function createdAtIdCursorOr(c: { date: string; id: string }) {
  const at = new Date(c.date);
  return [
    { createdAt: { lt: at } },
    { AND: [{ createdAt: at }, { id: { lt: c.id } }] },
  ];
}
