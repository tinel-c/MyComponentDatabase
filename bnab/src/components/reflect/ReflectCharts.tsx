"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsivePie } from "@nivo/pie";
import { ResponsiveBar } from "@nivo/bar";
import { ResponsiveLine } from "@nivo/line";
import type { PartialTheme } from "@nivo/theming";
import { BarChart3 } from "lucide-react";
import { cardClass } from "@/components/forms/field-classes";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/components/providers/ThemeProvider";

type ChartColors = {
  accent: string;
  accentFg: string;
  ok: string;
  danger: string;
  muted: string;
  subtle: string;
  rim: string;
  rimSubtle: string;
  fg: string;
  surface: string;
  overlay: string;
  slices: string[];
};

const FALLBACK: ChartColors = {
  accent: "oklch(0.72 0.17 160)",
  accentFg: "#ffffff",
  ok: "oklch(0.72 0.17 160)",
  danger: "oklch(0.65 0.2 25)",
  muted: "oklch(0.65 0.02 260)",
  subtle: "oklch(0.55 0.02 260)",
  rim: "oklch(0.35 0.02 260)",
  rimSubtle: "oklch(0.3 0.02 260)",
  fg: "oklch(0.95 0.01 260)",
  surface: "oklch(0.2 0.02 260)",
  overlay: "oklch(0.22 0.02 260)",
  slices: [],
};

function readThemeColors(): ChartColors {
  const s = getComputedStyle(document.documentElement);
  const accent = s.getPropertyValue("--accent").trim() || FALLBACK.accent;
  const accentFg =
    s.getPropertyValue("--accent-fg").trim() || FALLBACK.accentFg;
  const ok = s.getPropertyValue("--ok").trim() || accent;
  const danger = s.getPropertyValue("--danger").trim() || FALLBACK.danger;
  const muted = s.getPropertyValue("--fg-muted").trim() || FALLBACK.muted;
  const subtle = s.getPropertyValue("--fg-subtle").trim() || FALLBACK.subtle;
  const rim = s.getPropertyValue("--rim").trim() || FALLBACK.rim;
  const rimSubtle =
    s.getPropertyValue("--rim-subtle").trim() || FALLBACK.rimSubtle;
  const fg = s.getPropertyValue("--fg").trim() || FALLBACK.fg;
  const surface = s.getPropertyValue("--surface").trim() || FALLBACK.surface;
  const overlay = s.getPropertyValue("--overlay").trim() || FALLBACK.overlay;
  const accentHover = s.getPropertyValue("--accent-hover").trim() || accent;
  const accentMuted = s.getPropertyValue("--accent-muted").trim() || accent;
  return {
    accent,
    accentFg,
    ok,
    danger,
    muted,
    subtle,
    rim,
    rimSubtle,
    fg,
    surface,
    overlay,
    slices: [accent, ok, accentHover, danger, muted, accentMuted, fg, rim],
  };
}

export type OverlayItem = {
  id: string;
  label: string;
  date?: string;
  amount: number;
  href?: string;
};

export type SliceWithOverlay = {
  name: string;
  value: number;
  items?: OverlayItem[];
};

type IncomeExpenseRow = {
  month: string;
  income: number;
  expense: number;
  net: number;
  incomeItems?: OverlayItem[];
  expenseItems?: OverlayItem[];
};

function formatMajor(n: number, currency: string): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

function nivoTheme(colors: ChartColors): PartialTheme {
  return {
    background: "transparent",
    text: {
      fontSize: 11,
      fill: colors.muted,
      outlineWidth: 0,
      outlineColor: "transparent",
    },
    axis: {
      domain: {
        line: { stroke: colors.rim, strokeWidth: 1 },
      },
      ticks: {
        line: { stroke: colors.rim, strokeWidth: 1 },
        text: { fill: colors.muted, fontSize: 11 },
      },
      legend: {
        text: { fill: colors.muted, fontSize: 12 },
      },
    },
    grid: {
      line: { stroke: colors.rim, strokeWidth: 1, strokeOpacity: 0.35 },
    },
    legends: {
      text: { fill: colors.muted, fontSize: 11 },
    },
    labels: {
      text: {
        fill: colors.accentFg,
        fontSize: 12,
        fontWeight: 700,
        outlineWidth: 3,
        outlineColor: colors.surface,
      },
    },
    tooltip: {
      // Custom tooltips render their own panel; keep wrapper chrome empty
      // so we don't get a double box. (Nivo does not portal — tooltips are
      // position:absolute inside the chart, so parents must not clip.)
      container: {
        background: "transparent",
        color: colors.fg,
        fontSize: 12,
        borderRadius: 0,
        border: "none",
        boxShadow: "none",
        padding: 0,
      },
    },
    crosshair: {
      line: {
        stroke: colors.accent,
        strokeWidth: 1,
        strokeOpacity: 0.45,
      },
    },
  };
}

function OverlayList({
  title,
  value,
  items,
  currency,
  colors,
}: {
  title: string;
  value?: number | null;
  items?: OverlayItem[];
  currency: string;
  colors: ChartColors;
}) {
  return (
    <div
      className="max-w-xs text-xs"
      role="tooltip"
      style={{
        background: colors.overlay,
        color: colors.fg,
        border: `1px solid ${colors.rim}`,
        borderRadius: 12,
        padding: "10px 12px",
        boxShadow: `0 16px 40px color-mix(in oklch, ${colors.surface} 75%, transparent)`,
        pointerEvents: "none",
      }}
    >
      <p className="font-semibold" style={{ color: colors.fg }}>
        {title}
        {value != null ? (
          <span
            className="ml-2 tabular-nums"
            style={{ color: colors.muted }}
          >
            {formatMajor(value, currency)}
          </span>
        ) : null}
      </p>
      {items && items.length > 0 ? (
        <ul
          className="mt-2 max-h-48 space-y-1 overflow-y-auto pt-2"
          style={{ borderTop: `1px solid ${colors.rimSubtle}` }}
        >
          {items.map((item) => (
            <li
              key={item.id}
              className="flex justify-between gap-3"
              style={{ color: colors.muted }}
            >
              <span className="min-w-0 truncate">
                {item.date ? `${item.date} · ` : ""}
                {item.label}
              </span>
              <span
                className="shrink-0 tabular-nums font-medium"
                style={{ color: colors.fg }}
              >
                {formatMajor(item.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1" style={{ color: colors.subtle }}>
          No line details
        </p>
      )}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  empty,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <section
      className={`${cardClass} relative p-4`}
      style={{
        background:
          "linear-gradient(165deg, color-mix(in oklch, var(--surface) 92%, var(--accent-muted)) 0%, var(--surface) 55%)",
      }}
    >
      {/* Clip glow only — chart tooltips are absolute and must not be clipped */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        aria-hidden
      >
        <div
          className="absolute -right-8 -top-10 size-36 rounded-full opacity-40 blur-2xl"
          style={{ background: "var(--glow-accent)" }}
        />
      </div>
      <div className="relative">
        <h2 className="text-sm font-semibold text-fg">{title}</h2>
        {subtitle ? (
          <p className="mt-1 text-xs text-fg-muted">{subtitle}</p>
        ) : null}
        {empty ? (
          <div className="mt-2">{children}</div>
        ) : (
          <div className="relative z-10 mt-2 h-72 w-full overflow-visible sm:h-80">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}

export function ReflectCharts({
  currency,
  spending,
  payees,
  incomeExpense,
  netWorth,
  receiptSpending,
}: {
  currency: string;
  spending: SliceWithOverlay[];
  payees: SliceWithOverlay[];
  incomeExpense: IncomeExpenseRow[];
  netWorth: { month: string; assets: number; debts: number; net: number }[];
  receiptSpending?: SliceWithOverlay[];
}) {
  const { theme } = useTheme();
  const [colors, setColors] = useState<ChartColors>(FALLBACK);
  useEffect(() => {
    setColors(readThemeColors());
  }, [theme]);

  const themeCfg = useMemo(() => nivoTheme(colors), [colors]);
  const receipt = receiptSpending ?? [];

  const pieSpending = useMemo(
    () =>
      spending.map((d) => ({
        id: d.name,
        label: d.name,
        value: d.value,
        items: d.items,
      })),
    [spending],
  );

  const pieReceipt = useMemo(
    () =>
      receipt.map((d) => ({
        id: d.name,
        label: d.name,
        value: d.value,
        items: d.items,
      })),
    [receipt],
  );

  const payeeBars = useMemo(
    () =>
      payees.slice(0, 10).map((d) => ({
        payee: d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name,
        amount: d.value,
      })),
    [payees],
  );
  const payeeMeta = useMemo(() => {
    const m = new Map<string, { fullName: string; items?: OverlayItem[] }>();
    for (const d of payees.slice(0, 10)) {
      const key = d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name;
      m.set(key, { fullName: d.name, items: d.items });
    }
    return m;
  }, [payees]);

  const ieBars = useMemo(
    () =>
      incomeExpense.map((r) => ({
        month: r.month,
        Income: r.income,
        Expense: r.expense,
      })),
    [incomeExpense],
  );
  const ieMeta = useMemo(() => {
    const m = new Map<
      string,
      { incomeItems?: OverlayItem[]; expenseItems?: OverlayItem[] }
    >();
    for (const r of incomeExpense) {
      m.set(r.month, {
        incomeItems: r.incomeItems,
        expenseItems: r.expenseItems,
      });
    }
    return m;
  }, [incomeExpense]);

  const nwSeries = useMemo(
    () => [
      {
        id: "Assets",
        data: netWorth.map((r) => ({ x: r.month, y: r.assets })),
      },
      {
        id: "Debts",
        data: netWorth.map((r) => ({ x: r.month, y: r.debts })),
      },
      {
        id: "Net",
        data: netWorth.map((r) => ({ x: r.month, y: r.net })),
      },
    ],
    [netWorth],
  );

  const receiptBars = useMemo(
    () =>
      receipt.slice(0, 10).map((d) => ({
        category: d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name,
        amount: d.value,
      })),
    [receipt],
  );
  const receiptMeta = useMemo(() => {
    const m = new Map<string, { fullName: string; items?: OverlayItem[] }>();
    for (const d of receipt.slice(0, 10)) {
      const key = d.name.length > 18 ? `${d.name.slice(0, 16)}…` : d.name;
      m.set(key, { fullName: d.name, items: d.items });
    }
    return m;
  }, [receipt]);

  const lineColors = [colors.fg, colors.danger, colors.accent];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:gap-6">
      <ChartCard title="Spending by category" empty={spending.length === 0}>
        {spending.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No spending yet"
            description="Categorized outflows will show up here."
          />
        ) : (
          <ResponsivePie
            data={pieSpending}
            theme={themeCfg}
            margin={{ top: 16, right: 16, bottom: 48, left: 16 }}
            innerRadius={0.62}
            padAngle={1.4}
            cornerRadius={6}
            activeOuterRadiusOffset={10}
            colors={colors.slices}
            borderWidth={0}
            enableArcLinkLabels={false}
            arcLabelsSkipAngle={18}
            arcLabelsTextColor={colors.accentFg}
            motionConfig="gentle"
            transitionMode="pushIn"
            legends={[
              {
                anchor: "bottom",
                direction: "row",
                translateY: 40,
                itemWidth: 88,
                itemHeight: 14,
                symbolSize: 10,
                symbolShape: "circle",
              },
            ]}
            tooltip={({ datum }) => (
              <OverlayList
                title={String(datum.label)}
                value={datum.value}
                items={
                  (datum.data as { items?: OverlayItem[] }).items
                }
                currency={currency}
                colors={colors}
              />
            )}
          />
        )}
      </ChartCard>

      <ChartCard title="Spending by payee" empty={payees.length === 0}>
        {payees.length === 0 ? (
          <EmptyState icon={BarChart3} title="No payee data yet" />
        ) : (
          <ResponsiveBar
            data={payeeBars}
            keys={["amount"]}
            indexBy="payee"
            layout="horizontal"
            theme={themeCfg}
            margin={{ top: 8, right: 24, bottom: 28, left: 108 }}
            padding={0.28}
            borderRadius={6}
            colors={[colors.accent]}
            enableLabel={false}
            axisBottom={{
              tickSize: 0,
              tickPadding: 8,
              format: (v) =>
                typeof v === "number" ? Math.round(v).toLocaleString("ro-RO") : String(v),
            }}
            axisLeft={{ tickSize: 0, tickPadding: 8 }}
            motionConfig="gentle"
            tooltip={({ data }) => {
              const meta = payeeMeta.get(String(data.payee));
              return (
                <OverlayList
                  title={meta?.fullName ?? String(data.payee)}
                  value={Number(data.amount)}
                  items={meta?.items}
                  currency={currency}
                  colors={colors}
                />
              );
            }}
          />
        )}
      </ChartCard>

      <ChartCard title="Income vs Expense">
        <ResponsiveBar
          data={ieBars}
          keys={["Income", "Expense"]}
          indexBy="month"
          groupMode="grouped"
          theme={themeCfg}
          margin={{ top: 16, right: 16, bottom: 40, left: 48 }}
          padding={0.32}
          innerPadding={3}
          borderRadius={6}
          colors={[colors.ok, colors.danger]}
          enableLabel={false}
          axisBottom={{ tickSize: 0, tickPadding: 8 }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            format: (v) =>
              typeof v === "number" ? Math.round(v).toLocaleString("ro-RO") : String(v),
          }}
          legends={[
            {
              dataFrom: "keys",
              anchor: "bottom",
              direction: "row",
              translateY: 36,
              itemWidth: 80,
              itemHeight: 14,
              symbolSize: 10,
              symbolShape: "circle",
            },
          ]}
          motionConfig="gentle"
          tooltip={({ id, value, data }) => {
            const meta = ieMeta.get(String(data.month));
            return (
              <OverlayList
                title={`${data.month} · ${String(id)}`}
                value={value}
                items={
                  id === "Income" ? meta?.incomeItems : meta?.expenseItems
                }
                currency={currency}
                colors={colors}
              />
            );
          }}
        />
      </ChartCard>

      <ChartCard title="Net worth">
        <ResponsiveLine
          data={nwSeries}
          theme={themeCfg}
          margin={{ top: 16, right: 20, bottom: 48, left: 52 }}
          xScale={{ type: "point" }}
          yScale={{ type: "linear", min: "auto", max: "auto", stacked: false }}
          curve="monotoneX"
          colors={lineColors}
          lineWidth={2.5}
          enableArea
          areaOpacity={0.12}
          enablePoints
          pointSize={8}
          pointColor={{ theme: "background" }}
          pointBorderWidth={2}
          pointBorderColor={{ from: "seriesColor" }}
          enableGridX={false}
          axisBottom={{ tickSize: 0, tickPadding: 10 }}
          axisLeft={{
            tickSize: 0,
            tickPadding: 8,
            format: (v) =>
              typeof v === "number" ? Math.round(v).toLocaleString("ro-RO") : String(v),
          }}
          useMesh
          enableSlices="x"
          legends={[
            {
              anchor: "bottom",
              direction: "row",
              translateY: 42,
              itemWidth: 72,
              itemHeight: 14,
              symbolSize: 10,
              symbolShape: "circle",
            },
          ]}
          motionConfig="gentle"
          sliceTooltip={({ slice }) => (
            <div
              className="min-w-[10rem] space-y-1 text-xs"
              role="tooltip"
              style={{
                background: colors.overlay,
                color: colors.fg,
                border: `1px solid ${colors.rim}`,
                borderRadius: 12,
                padding: "10px 12px",
                boxShadow: `0 16px 40px color-mix(in oklch, ${colors.surface} 75%, transparent)`,
                pointerEvents: "none",
              }}
            >
              <p className="font-semibold" style={{ color: colors.fg }}>
                {String(slice.points[0]?.data.x)}
              </p>
              {slice.points.map((p) => (
                <p
                  key={p.id}
                  className="flex justify-between gap-4"
                  style={{ color: colors.muted }}
                >
                  <span style={{ color: p.seriesColor }}>{p.seriesId}</span>
                  <span
                    className="tabular-nums font-medium"
                    style={{ color: colors.fg }}
                  >
                    {formatMajor(Number(p.data.y), currency)}
                  </span>
                </p>
              ))}
            </div>
          )}
        />
      </ChartCard>

      {receipt.length > 0 ? (
        <>
          <ChartCard
            title="Receipt-detailed by category"
            subtitle="Line items from bill scans — hover for top products."
          >
            <ResponsivePie
              data={pieReceipt}
              theme={themeCfg}
              margin={{ top: 16, right: 16, bottom: 48, left: 16 }}
              innerRadius={0.58}
              padAngle={1.4}
              cornerRadius={6}
              activeOuterRadiusOffset={10}
              colors={colors.slices}
              enableArcLinkLabels={false}
              arcLabelsSkipAngle={18}
              arcLabelsTextColor={colors.accentFg}
              motionConfig="gentle"
              transitionMode="pushIn"
              legends={[
                {
                  anchor: "bottom",
                  direction: "row",
                  translateY: 40,
                  itemWidth: 88,
                  itemHeight: 14,
                  symbolSize: 10,
                  symbolShape: "circle",
                },
              ]}
              tooltip={({ datum }) => (
                <OverlayList
                  title={String(datum.label)}
                  value={datum.value}
                  items={(datum.data as { items?: OverlayItem[] }).items}
                  currency={currency}
                  colors={colors}
                />
              )}
            />
          </ChartCard>

          <ChartCard title="Receipt categories (bars)">
            <ResponsiveBar
              data={receiptBars}
              keys={["amount"]}
              indexBy="category"
              layout="horizontal"
              theme={themeCfg}
              margin={{ top: 8, right: 24, bottom: 28, left: 108 }}
              padding={0.28}
              borderRadius={6}
              colors={[colors.ok]}
              enableLabel={false}
              axisBottom={{
                tickSize: 0,
                tickPadding: 8,
                format: (v) =>
                  typeof v === "number"
                    ? Math.round(v).toLocaleString("ro-RO")
                    : String(v),
              }}
              axisLeft={{ tickSize: 0, tickPadding: 8 }}
              motionConfig="gentle"
              tooltip={({ data }) => {
                const meta = receiptMeta.get(String(data.category));
                return (
                  <OverlayList
                    title={meta?.fullName ?? String(data.category)}
                    value={Number(data.amount)}
                    items={meta?.items}
                    currency={currency}
                    colors={colors}
                  />
                );
              }}
            />
          </ChartCard>
        </>
      ) : null}
    </div>
  );
}
