/**
 * Theme configuration for BNAB.
 * Uses the same semantic tokens as Hobby Warehouse.
 */

export type ThemeId =
  | "midnight-zinc"
  | "nebula"
  | "aurora"
  | "carbon"
  | "light";

export interface ThemeConfig {
  id: ThemeId;
  label: string;
  description: string;
  isDark: boolean;
  preview: { bg: string; surface: string; accent: string; text: string };
}

export const THEMES: ThemeConfig[] = [
  {
    id: "midnight-zinc",
    label: "Midnight Zinc",
    description: "Deep zinc dark · emerald accent",
    isDark: true,
    preview: { bg: "#09090b", surface: "#18181b", accent: "#10b981", text: "#fafafa" },
  },
  {
    id: "nebula",
    label: "Nebula",
    description: "Deep space blue · violet accent",
    isDark: true,
    preview: { bg: "#0d0f17", surface: "#141726", accent: "#8b5cf6", text: "#e8ecff" },
  },
  {
    id: "aurora",
    label: "Aurora",
    description: "Deep teal ocean · cyan accent",
    isDark: true,
    preview: { bg: "#060d12", surface: "#0d1a24", accent: "#06b6d4", text: "#e0f2fe" },
  },
  {
    id: "carbon",
    label: "Carbon",
    description: "Warm dark · electric blue accent",
    isDark: true,
    preview: { bg: "#111111", surface: "#1a1a1a", accent: "#3b82f6", text: "#f5f5f5" },
  },
  {
    id: "light",
    label: "Light",
    description: "Clean light · violet accent",
    isDark: false,
    preview: { bg: "#f8fafc", surface: "#ffffff", accent: "#7c3aed", text: "#0f172a" },
  },
];

export const DEFAULT_THEME: ThemeId = "midnight-zinc";
export const THEME_STORAGE_KEY = "bnab-theme";

export function getTheme(id: string | null | undefined): ThemeConfig {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

export const DARK_THEME_IDS: ThemeId[] = THEMES.filter((t) => t.isDark).map((t) => t.id);
