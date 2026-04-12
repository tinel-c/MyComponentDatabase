/** Plain-text preview for part cards (Markdown-heavy descriptions). */
export function partDescriptionForCard(
  description: string | null | undefined,
  maxLen = 220,
): string {
  if (!description?.trim()) {
    return "No description on file.";
  }
  let t = description.replace(/\r\n/g, "\n");
  t = t.replace(/^#{1,6}\s+/gm, "");
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/\*([^*]+)\*/g, "$1");
  t = t.replace(/`([^`]+)`/g, "$1");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  t = t.replace(/^\s*[-*+]\s+/gm, "");
  t = t.replace(/\n+/g, " ");
  t = t.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trimEnd()}…`;
}
