"use server";

import { auth } from "@/auth";
import { searchPartImageCandidates } from "@/lib/image-search";

export type ImageSearchResult =
  | { ok: true; candidates: Awaited<ReturnType<typeof searchPartImageCandidates>> }
  | { ok: false; error: string };

export async function runPartImageSearch(query: string): Promise<ImageSearchResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Not signed in." };
  }

  const q = query.trim();
  if (q.length < 2) {
    return { ok: false, error: "Enter at least 2 characters (e.g. MPN or part name)." };
  }

  try {
    const candidates = await searchPartImageCandidates(q, 12);
    return { ok: true, candidates };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed.";
    return { ok: false, error: msg };
  }
}
