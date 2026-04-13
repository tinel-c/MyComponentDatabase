/** Order forest nodes so every parent appears before its children. */
export function topologicalSortForest<T extends { id: string; parentId: string | null }>(
  items: T[],
): T[] {
  if (items.length === 0) return [];
  const ids = new Set(items.map((x) => x.id));
  const result: T[] = [];
  const added = new Set<string>();
  let rounds = 0;
  const maxRounds = items.length + 2;
  while (result.length < items.length && rounds < maxRounds) {
    rounds++;
    let progressed = false;
    for (const item of items) {
      if (added.has(item.id)) continue;
      const p = item.parentId;
      if (p == null) {
        result.push(item);
        added.add(item.id);
        progressed = true;
        continue;
      }
      if (!ids.has(p)) {
        throw new Error(`Invalid tree: parentId "${p}" not found for id "${item.id}"`);
      }
      if (added.has(p)) {
        result.push(item);
        added.add(item.id);
        progressed = true;
      }
    }
    if (!progressed) {
      throw new Error("Invalid tree: cycle or missing parent reference");
    }
  }
  if (result.length !== items.length) {
    throw new Error("Invalid tree: could not order all nodes");
  }
  return result;
}
