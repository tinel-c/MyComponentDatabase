import fs from "node:fs/promises";
import path from "node:path";

export function receiptDir(): string {
  return (
    process.env.BNAB_RECEIPT_DIR?.trim() ||
    path.join(process.cwd(), ".data", "receipts")
  );
}

export async function saveReceiptImage(params: {
  budgetId: string;
  transactionId: string;
  bytes: Buffer;
  ext: string;
}): Promise<string> {
  const dir = path.join(receiptDir(), params.budgetId);
  await fs.mkdir(dir, { recursive: true });
  const name = `${params.transactionId}-${Date.now()}.${params.ext}`;
  const full = path.join(dir, name);
  await fs.writeFile(full, params.bytes);
  return full;
}
