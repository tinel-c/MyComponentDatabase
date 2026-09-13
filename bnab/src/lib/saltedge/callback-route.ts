import { NextRequest, NextResponse } from "next/server";
import {
  handleSaltEdgeCallback,
  type CallbackKind,
} from "@/lib/saltedge/handle-callback";

export const dynamic = "force-dynamic";

export function makeSaltEdgeCallbackHandler(kind: CallbackKind) {
  return async function POST(req: NextRequest) {
    const rawBody = await req.text();
    const signature = req.headers.get("Signature") ?? req.headers.get("signature");
    // Use the public URL Salt Edge posted to (no trailing slash mismatch).
    const requestUrl = req.nextUrl.href.replace(/\/$/, "");
    const result = await handleSaltEdgeCallback({
      kind,
      requestUrl,
      rawBody,
      signature,
    });
    return NextResponse.json(
      { ok: result.ok, detail: result.detail ?? null },
      { status: result.status },
    );
  };
}
