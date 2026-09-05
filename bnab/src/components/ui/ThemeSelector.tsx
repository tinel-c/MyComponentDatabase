"use client";

import { THEMES, type ThemeId } from "@/lib/themes";
import { useTheme } from "@/components/providers/ThemeProvider";

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTheme(t.id as ThemeId)}
          className={`rounded-xl border p-3 text-left transition ${
            theme === t.id
              ? "border-accent ring-1 ring-accent/40"
              : "border-rim/60 hover:border-rim"
          }`}
        >
          <div className="mb-2 flex gap-1">
            <span
              className="size-4 rounded-full"
              style={{ background: t.preview.bg }}
            />
            <span
              className="size-4 rounded-full"
              style={{ background: t.preview.surface }}
            />
            <span
              className="size-4 rounded-full"
              style={{ background: t.preview.accent }}
            />
          </div>
          <p className="text-sm font-medium text-fg">{t.label}</p>
          <p className="text-[11px] text-fg-subtle">{t.description}</p>
        </button>
      ))}
    </div>
  );
}
