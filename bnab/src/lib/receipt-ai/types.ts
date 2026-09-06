export type ReceiptLineParsed = {
  description: string;
  /** Absolute amount in major units (RON), positive */
  amount: number;
  categoryHint?: string;
};

export type GeminiReceiptResult = {
  merchant?: string;
  date?: string;
  total?: number;
  currency?: string;
  lines: ReceiptLineParsed[];
  rawText: string;
  model: string;
};

export type MappedReceiptLine = {
  description: string;
  amountCents: number;
  categoryHint: string | null;
  categoryId: string | null;
  categoryName: string | null;
  matchedRuleId: string | null;
  ignored: boolean;
};

export type ProposedSplit = {
  categoryId: string;
  categoryName: string;
  amountCents: number;
  notes: string;
};

export type ProcessReceiptResult = {
  scanId: string;
  status: "ok" | "error" | "preview";
  errorText?: string;
  lines: MappedReceiptLine[];
  proposedSplits: ProposedSplit[];
  applied?: boolean;
};
