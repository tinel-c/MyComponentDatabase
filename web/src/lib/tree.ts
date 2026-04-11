export type TreeNode = {
  id: string;
  name: string;
  parentId: string | null;
};

/** Flatten tree depth-first for select options with indentation. */
export function flatTreeForSelect(nodes: TreeNode[]): { id: string; label: string }[] {
  const byParent = new Map<string | null, TreeNode[]>();
  for (const n of nodes) {
    const key = n.parentId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(n);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }
  const out: { id: string; label: string }[] = [];
  function walk(parentId: string | null, depth: number) {
    const kids = byParent.get(parentId) ?? [];
    for (const k of kids) {
      out.push({
        id: k.id,
        label: `${"\u2014 ".repeat(depth)}${k.name}`,
      });
      walk(k.id, depth + 1);
    }
  }
  walk(null, 0);
  return out;
}

/** Node id plus all descendants — cannot be chosen as parent without a cycle. */
export function blockedDescendantIds(nodeId: string, nodes: TreeNode[]): Set<string> {
  const blocked = new Set<string>([nodeId]);
  let frontier = [nodeId];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const n of nodes) {
        if (n.parentId === id) {
          blocked.add(n.id);
          next.push(n.id);
        }
      }
    }
    frontier = next;
  }
  return blocked;
}
