# Receipt detailing agent (Gemini)

BNAB can split spending using a **bill photo** and Google **Gemini** vision.

## Flows

### A. Detail an existing bank transaction
1. Open an outflow → **Detail from bill**, or Import bill → pick a matching row.
2. Gemini returns line items → `ReceiptCategoryRule` maps → confirm splits.

### B. Create entry now, link on ING import later
1. **More → Import bill** → upload photo.
2. If no bank match (or you prefer), **Create entry & apply categories**.
3. Saves merchant, date, total, and category splits as a **manual** transaction
   (`importFingerprint` empty, uncleared, notes `Bill import · pending statement`).
4. When you import the ING CSV, that row shows as **possible manual match** —
   choose **Link** to stamp the fingerprint (categories kept; date/cleared sync
   to the statement).

## Env

```
GEMINI_API_KEY=...
# optional
GEMINI_MODEL=gemini-3.6-flash
BNAB_RECEIPT_DIR=/opt/bnab/shared/receipts
```

## Agent rules (summary)

- Net amounts after Lidl Plus / PV discounts; skip TVA and payment footers.
- Prefer Clothing / Pets / Education / Household Goods / Tools / Look&Feel / Presents over a single Groceries bucket when the receipt mixes them.
- Sum of lines must match the bank amount within 2 bani.

See `src/lib/receipt-ai/prompt.ts` for the full system prompt and `default-rules.ts` for Lidl seed mappings.
