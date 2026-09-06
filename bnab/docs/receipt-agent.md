# Receipt detailing agent (Gemini)

BNAB can split an ING bank transaction using a **bill photo** and Google **Gemini** vision.

## Flow

1. Open an outflow transaction → **Detail from bill**.
2. Upload JPEG/PNG/WebP → `processReceiptDetailing` (programmatic entry in `src/lib/receipt-ai`).
3. Gemini returns line items as JSON.
4. `ReceiptCategoryRule` (More → Receipt mappings) maps descriptions → budget categories.
5. Confirm → parent becomes a split; one child per category (aggregated). Plan + Reflect use children.

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
