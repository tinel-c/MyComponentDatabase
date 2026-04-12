/** Parse repeated `purchaseLinkLabel` / `purchaseLinkUrl` fields from a part form. */
export function parsePurchaseLinksFromForm(formData: FormData): { label: string; url: string }[] {
  const labels = formData.getAll("purchaseLinkLabel");
  const urls = formData.getAll("purchaseLinkUrl");
  const n = Math.max(labels.length, urls.length);
  const out: { label: string; url: string }[] = [];
  for (let i = 0; i < n; i++) {
    const url = String(urls[i] ?? "").trim();
    if (!url) continue;
    let label = String(labels[i] ?? "").trim();
    if (!label) label = "Shop";
    try {
      const u = new URL(url);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
    } catch {
      continue;
    }
    out.push({ label: label.slice(0, 200), url: url.slice(0, 2000) });
  }
  return out;
}
