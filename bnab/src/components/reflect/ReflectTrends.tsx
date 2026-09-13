"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ResponsiveBar } from "@nivo/bar";
import type { PartialTheme } from "@nivo/theming";
import { cardCompactClass, chipClass, chipMutedClass } from "@/components/forms/field-classes";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
  isOtherTrendSeries,
  type SpendTrendMode,
  type SpendTrendResult,
} from "@/lib/reflect-trends";

type ChartColors = {
  accent: string;
  ok: string;
  danger: string;
  muted: string;
  subtle: string;
  rim: string;
  fg: string;
  surface: string;
  overlay: string;
  slices: string[];
};

const FALLBACK: ChartColors = {
  accent: "oklch(0.72 0.17 160)",
  ok: "oklch(0.72 0.17 160)",
  danger: "oklch(0.65 0.2 25)",
  muted: "oklch(0.65 0.02 260)",
  subtle: "oklch(0.55 0.02 260)",
  rim: "oklch(0.35 0.02 260)",
  fg: "oklch(0.95 0.01 260)",
  surface: "oklch(0.2 0.02 260)",
  overlay: "oklch(0.22 0.02 260)",
  slices: [],
};

function readThemeColors(): ChartColors {
  const s = getComputedStyle(document.documentElement);
  const accent = s.getPropertyValue("--accent").trim() || FALLBACK.accent;
  const ok = s.getPropertyValue("--ok").trim() || accent;
  const danger = s.getPropertyValue("--danger").trim() || FALLBACK.danger;
  const muted = s.getPropertyValue("--fg-muted").trim() || FALLBACK.muted;
  const subtle = s.getPropertyValue("--fg-subtle").trim() || FALLBACK.subtle;
  const rim = s.getPropertyValue("--rim").trim() || FALLBACK.rim;
  const fg = s.getPropertyValue("--fg").trim() || FALLBACK.fg;
  const surface = s.getPropertyValue("--surface").trim() || FALLBACK.surface;
  const overlay = s.getPropertyValue("--overlay").trim() || FALLBACK.overlay;
  const accentHover = s.getPropertyValue("--accent-hover").trim() || accent;
  return {
    accent,
    ok,
    danger,
    muted,
    subtle,
    rim,
    fg,
    surface,
    overlay,
    slices: [accent, ok, accentHover, danger, muted, fg, rim],
  };
}

function formatMajor(n: number, currency: string): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function nivoTheme(colors: ChartColors): PartialTheme {
  return {
    background: "transparent",
    text: { fontSize: 11, fill: colors.muted },
    axis: {
      ticks: { text: { fill: colors.muted, fontSize: 11 } },
    },
    grid: {
      line: { stroke: colors.rim, strokeWidth: 1, strokeOpacity: 0.35 },
    },
    tooltip: {
      container: {
        background: "transparent",
        padding: 0,
        border: "none",
        boxShadow: "none",
      },
    },
  };
}

function registerHref(opts: {
  month: string;
  categoryId?: string;
  groupId?: string;
  accountId?: string;
}): string {
  const sp = new URLSearchParams();
  sp.set("month", opts.month);
  if (opts.categoryId) sp.set("categoryId", opts.categoryId);
  else if (opts.groupId) sp.set("groupId", opts.groupId);
  if (opts.accountId) sp.set("accountId", opts.accountId);
  return `/transactions?${sp.toString()}`;
}

export function ReflectTrends({
  currency,
  byCategory,
  byGroup,
  accountId,
  initialMode = "group",
}: {
  currency: string;
  byCategory: SpendTrendResult;
  byGroup: SpendTrendResult;
  accountId?: string;
  initialMode?: SpendTrendMode;
}) {
  const { theme } = useTheme();
  const [mode, setMode] = useState<SpendTrendMode>(initialMode);
  const colors = useMemo(() => {
    void theme;
    if (typeof document === "undefined") return FALLBACK;
    return readThemeColors();
  }, [theme]);

  const data = mode === "group" ? byGroup : byCategory;
  const keys = data.series.map((s) => s.id);

  const barData = useMemo(
    () =>
      data.months.map((m, i) => {
        const row: Record<string, string | number> = {
          month: m.slice(5),
          monthFull: m,
        };
        for (const s of data.series) {
          row[s.id] = s.values[i] / 100;
        }
        return row;
      }),
    [data],
  );

  const colorById = useMemo(() => {
    const map = new Map<string, string>();
    data.series.forEach((s, i) => {
      map.set(
        s.id,
        isOtherTrendSeries(s.id)
          ? colors.subtle
          : colors.slices[i % Math.max(colors.slices.length, 1)] || colors.accent,
      );
    });
    return map;
  }, [data.series, colors]);

  if (data.series.length === 0) {
    return (
      <section className={`${cardCompactClass} p-4 text-sm text-fg-muted`}>
        No spending in this span to chart as trends.
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-fg">Spending trends</h2>
          <p className="mt-0.5 text-[11px] text-fg-subtle">
            Month-over-month stack · click a segment or legend to open the register
          </p>
        </div>
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Trend breakdown"
        >
          <button
            type="button"
            className={mode === "group" ? chipClass : chipMutedClass}
            onClick={() => setMode("group")}
          >
            Category groups
          </button>
          <button
            type="button"
            className={mode === "category" ? chipClass : chipMutedClass}
            onClick={() => setMode("category")}
          >
            Categories
          </button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <section className={`${cardCompactClass} overflow-visible p-3`}>
          <div className="h-80 w-full">
            <ResponsiveBar
              data={barData}
              keys={keys}
              indexBy="month"
              groupMode="stacked"
              margin={{ top: 12, right: 12, bottom: 36, left: 52 }}
              padding={0.28}
              colors={(d) => colorById.get(String(d.id)) ?? colors.accent}
              theme={nivoTheme(colors)}
              axisBottom={{ tickSize: 0, tickPadding: 8 }}
              axisLeft={{
                tickSize: 0,
                tickPadding: 6,
                format: (v) =>
                  new Intl.NumberFormat("ro-RO", {
                    notation: "compact",
                    maximumFractionDigits: 1,
                  }).format(Number(v)),
              }}
              enableLabel={false}
              valueScale={{ type: "linear" }}
              tooltip={({ id, value, indexValue, data: row }) => {
                const series = data.series.find((s) => s.id === id);
                return (
                  <div
                    className="rounded-xl px-3 py-2 text-xs shadow-lg"
                    style={{
                      background: colors.overlay,
                      color: colors.fg,
                      border: `1px solid ${colors.rim}`,
                    }}
                  >
                    <p className="font-semibold">
                      {series?.name ?? String(id)} · {String(indexValue)}
                    </p>
                    <p className="mt-0.5 tabular-nums text-fg-muted">
                      {formatMajor(Number(value), currency)}
                    </p>
                    {row.monthFull &&
                    series &&
                    !isOtherTrendSeries(series.id) ? (
                      <p className="mt-1 text-[10px]" style={{ color: colors.subtle }}>
                        Click segment to open register
                      </p>
                    ) : null}
                  </div>
                );
              }}
              onClick={(datum) => {
                const series = data.series.find((s) => s.id === datum.id);
                const monthFull = String(datum.data.monthFull ?? "");
                if (!series || !monthFull || isOtherTrendSeries(series.id)) {
                  return;
                }
                const href = registerHref({
                  month: monthFull,
                  categoryId:
                    mode === "category" ? series.drillCategoryId : undefined,
                  groupId:
                    mode === "group" ? series.drillGroupId : undefined,
                  accountId,
                });
                if (href.includes("categoryId=") || href.includes("groupId=")) {
                  window.location.href = href;
                }
              }}
            />
          </div>
        </section>

        <aside className={`${cardCompactClass} p-3`}>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            Span totals
          </h3>
          <p className="mt-1 text-sm font-semibold tabular-nums text-fg">
            {formatMajor(data.grandTotalCents / 100, currency)}
          </p>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto text-sm">
            {data.series.map((s) => {
              const canLink =
                !isOtherTrendSeries(s.id) &&
                (s.drillCategoryId || s.drillGroupId);
              const href = canLink
                ? registerHref({
                    month: data.months[data.months.length - 1] ?? "",
                    categoryId:
                      mode === "category" ? s.drillCategoryId : undefined,
                    groupId: mode === "group" ? s.drillGroupId : undefined,
                    accountId,
                  })
                : undefined;
              const row = (
                <>
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-sm"
                      style={{
                        background: colorById.get(s.id) ?? colors.accent,
                      }}
                      aria-hidden
                    />
                    <span className="min-w-0 truncate font-medium text-fg">
                      {s.name}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-fg-muted">
                    <span className="block tabular-nums text-fg">
                      {formatMajor(s.totalCents / 100, currency)}
                    </span>
                    <span className="block text-[10px] tabular-nums">
                      avg {formatMajor(s.averageCents / 100, currency)} ·{" "}
                      {s.percent}%
                    </span>
                  </span>
                </>
              );
              return (
                <li key={s.id}>
                  {href ? (
                    <Link
                      href={href}
                      className="flex items-start justify-between gap-2 rounded-md px-1 py-0.5 underline-offset-2 hover:bg-overlay hover:underline"
                      title="Open register for latest month in span"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div className="flex items-start justify-between gap-2 px-1 py-0.5">
                      {row}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
