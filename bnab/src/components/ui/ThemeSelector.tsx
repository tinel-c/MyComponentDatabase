"use client";

import { Check } from "lucide-react";
import { THEMES, type ThemeId } from "@/lib/themes";
import { useTheme } from "@/components/providers/ThemeProvider";

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {THEMES.map((t) => {
        const selected = theme === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id as ThemeId)}
            className={`relative rounded-xl border p-3 text-left transition ${
              selected
                ? "border-accent bg-accent-muted/40 ring-1 ring-accent/40"
                : "border-rim/60 hover:border-rim hover:bg-overlay/40"
            }`}
          >
            {selected ? (
              <span
                className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-accent text-accent-fg"
                aria-hidden
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
            ) : null}
            <div className="mb-2 flex gap-1">
              <span
                className="size-4 rounded-full border border-rim-subtle"
                style={{ background: t.preview.bg }}
              />
              <span
                className="size-4 rounded-full border border-rim-subtle"
                style={{ background: t.preview.surface }}
              />
              <span
                className="size-4 rounded-full border border-rim-subtle"
                style={{ background: t.preview.accent }}
              />
            </div>
            <p className="text-sm font-medium text-fg">{t.label}</p>
            <p className="text-[11px] text-fg-subtle">{t.description}</p>
          </button>
        );
      })}
    </div>
  );
}
