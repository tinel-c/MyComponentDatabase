"use client";

import { useTheme } from "@/components/providers/ThemeProvider";
import { THEMES, type ThemeConfig } from "@/lib/themes";
import { Palette, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function ThemeSwatch({ theme, isActive, onSelect }: {
  theme: ThemeConfig;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full rounded-xl p-3 text-left transition-all duration-150 ${
        isActive
          ? "ring-2 ring-accent bg-accent-muted"
          : "hover:bg-fg/5 ring-1 ring-rim/60"
      }`}
      aria-label={`Switch to ${theme.label} theme`}
      aria-pressed={isActive}
    >
      <div className="flex items-center gap-3">
        {/* Mini preview */}
        <div
          className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-white/10"
          style={{ background: theme.preview.bg }}
        >
          {/* Surface strip */}
          <div
            className="absolute inset-x-0 bottom-0 h-4"
            style={{ background: theme.preview.surface }}
          />
          {/* Accent dot */}
          <div
            className="absolute bottom-1 right-1 h-2 w-2 rounded-full"
            style={{ background: theme.preview.accent }}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p
            className="text-xs font-semibold leading-none"
            style={{ color: isActive ? "var(--accent)" : "var(--fg)" }}
          >
            {theme.label}
          </p>
          <p
            className="mt-1 truncate text-[10px] leading-none"
            style={{ color: "var(--fg-muted)" }}
          >
            {theme.description}
          </p>
        </div>

        {isActive && (
          <Check
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "var(--accent)" }}
            aria-hidden
          />
        )}
      </div>
    </button>
  );
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const activeTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-150 ${
          open
            ? "bg-accent-muted text-accent ring-1 ring-accent/40"
            : "text-fg-muted hover:bg-fg/5 hover:text-fg"
        }`}
        aria-label="Change theme"
        aria-expanded={open}
      >
        {/* Active accent swatch */}
        <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
          <span
            className="absolute h-full w-full rounded-full opacity-20"
            style={{ background: activeTheme.preview.accent }}
          />
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: activeTheme.preview.accent }}
          />
        </span>
        <span className="flex-1 text-left font-medium">{activeTheme.label}</span>
        <Palette className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 right-0 z-[60] mb-2 overflow-hidden rounded-2xl border shadow-2xl"
          style={{
            background: "var(--overlay)",
            borderColor: "var(--rim)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px var(--rim)",
          }}
        >
          <div className="px-3 pb-2 pt-3">
            <p
              className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: "var(--fg-subtle)" }}
            >
              Choose theme
            </p>
            <div className="space-y-1">
              {THEMES.map((t) => (
                <ThemeSwatch
                  key={t.id}
                  theme={t}
                  isActive={t.id === theme}
                  onSelect={() => {
                    setTheme(t.id);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
