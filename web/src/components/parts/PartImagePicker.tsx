"use client";

import { runPartImageSearch } from "@/app/(dashboard)/parts/image-search-actions";
import { useCallback, useState } from "react";

const secondaryBtn =
  "inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";

type Props = {
  /** Current image URL (controlled). */
  imageUrl: string;
  setImageUrl: (url: string) => void;
  /** Build search query from form (MPN + name + manufacturer). */
  getSearchQuery: () => string;
};

export function PartImagePicker({ imageUrl, setImageUrl, getSearchQuery }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<
    { url: string; thumbUrl: string; title: string; source: string }[]
  >([]);

  const handleSearch = useCallback(async () => {
    const q = getSearchQuery().trim();
    setError(null);
    setCandidates([]);
    if (q.length < 2) {
      setError("Fill in MPN or name (at least 2 characters) before searching.");
      return;
    }
    setLoading(true);
    try {
      const res = await runPartImageSearch(q);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.candidates.length === 0) {
        setError("No images found — try a shorter query or paste a URL.");
        return;
      }
      setCandidates(res.candidates);
    } finally {
      setLoading(false);
    }
  }, [getSearchQuery]);

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-4 dark:border-zinc-600 dark:bg-zinc-950/40">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Image from the web</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Searches open images (Wikimedia Commons; optional Google if configured). Click a thumb to
            pin it as the card image, then save.
          </p>
        </div>
        <button type="button" className={secondaryBtn} disabled={loading} onClick={handleSearch}>
          {loading ? "Searching…" : "Suggest images"}
        </button>
      </div>
      {error ? (
        <p className="text-xs text-zinc-300" role="alert">
          {error}
        </p>
      ) : null}
      {candidates.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
          {candidates.map((c) => {
            const pinned = imageUrl === c.url;
            return (
              <li key={c.url}>
                <button
                  type="button"
                  onClick={() => {
                    setImageUrl(c.url);
                  }}
                  className={`group relative w-full overflow-hidden rounded-lg border-2 bg-white text-left transition ${
                    pinned
                      ? "border-zinc-500 ring-2 ring-zinc-400/50"
                      : "border-zinc-800 hover:border-zinc-500/80"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.thumbUrl}
                    alt=""
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute bottom-0 left-0 right-0 truncate bg-black/55 px-1 py-0.5 text-[9px] text-white opacity-0 transition group-hover:opacity-100">
                    {c.source} · {c.title}
                  </span>
                  {pinned ? (
                    <span className="absolute right-1 top-1 rounded bg-zinc-600 px-1 text-[10px] font-bold text-zinc-100">
                      Pinned
                    </span>
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[10px] font-medium text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                      Use
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {imageUrl ? (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Selected URL is in the field below — press <strong>Save changes</strong> to store it.
        </p>
      ) : null}
    </div>
  );
}
