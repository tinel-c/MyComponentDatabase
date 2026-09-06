import { buildReceiptSystemPrompt } from "./prompt";
import type { GeminiReceiptResult, ReceiptLineParsed } from "./types";

function geminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
}

function geminiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  return key;
}

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Gemini response was not valid JSON");
  }
}

function normalizeLines(raw: unknown): ReceiptLineParsed[] {
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as Record<string, unknown>;
  const lines = Array.isArray(obj.lines) ? obj.lines : [];
  const out: ReceiptLineParsed[] = [];
  for (const row of lines) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const description = String(r.description ?? "").trim();
    const amount = Number(r.amount);
    if (!description || !Number.isFinite(amount) || amount === 0) continue;
    out.push({
      description,
      amount: Math.abs(amount),
      categoryHint:
        typeof r.categoryHint === "string" ? r.categoryHint.trim() : undefined,
    });
  }
  return out;
}

export async function parseReceiptWithGemini(params: {
  imageBytes: Buffer;
  mimeType: string;
  categoryNames: string[];
  currency: string;
  expectedTotalCents: number;
  merchantHint?: string | null;
  dateHint?: string | null;
}): Promise<GeminiReceiptResult> {
  const model = geminiModel();
  const key = geminiKey();
  const expectedTotalMajor = Math.abs(params.expectedTotalCents) / 100;
  const prompt = buildReceiptSystemPrompt({
    categoryNames: params.categoryNames,
    currency: params.currency,
    expectedTotalMajor,
    merchantHint: params.merchantHint,
    dateHint: params.dateHint,
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: params.mimeType,
              data: params.imageBytes.toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
    },
  };

  let res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 800));
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }

  const payload = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";
  if (!text) throw new Error("Gemini returned an empty response");

  const parsed = extractJsonObject(text) as Record<string, unknown>;
  const lines = normalizeLines(parsed);

  return {
    merchant: typeof parsed.merchant === "string" ? parsed.merchant : undefined,
    date: typeof parsed.date === "string" ? parsed.date : undefined,
    total: typeof parsed.total === "number" ? parsed.total : undefined,
    currency:
      typeof parsed.currency === "string" ? parsed.currency : undefined,
    lines,
    rawText: text,
    model,
  };
}
