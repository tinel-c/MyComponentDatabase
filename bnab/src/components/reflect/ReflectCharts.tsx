"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { cardClass } from "@/components/forms/field-classes";
import { EmptyState } from "@/components/ui/EmptyState";

type ChartColors = {
  accent: string;
  ok: string;
  danger: string;
  muted: string;
  rim: string;
  slices: string[];
};

const FALLBACK: ChartColors = {
  accent: "#10b981",
  ok: "#10b981",
  danger: "#f43f5e",
  muted: "#64748b",
  rim: "#334155",
  slices: ["#10b981", "#06b6d4", "#3b82f6", "#f59e0b", "#ef4444", "#84cc16"],
};

function readThemeColors(): ChartColors {
  const s = getComputedStyle(document.documentElement);
  const accent = s.getPropertyValue("--accent").trim() || FALLBACK.accent;
  const ok = s.getPropertyValue("--ok").trim() || accent;
  const danger = s.getPropertyValue("--danger").trim() || FALLBACK.danger;
  const muted = s.getPropertyValue("--fg-muted").trim() || FALLBACK.muted;
  const rim = s.getPropertyValue("--rim").trim() || FALLBACK.rim;
  return {
    accent,
    ok,
    danger,
    muted,
    rim,
    slices: [accent, ok, "#06b6d4", "#3b82f6", "#f59e0b", danger, "#84cc16", muted],
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

function OverlayTooltip({
  active,
  payload,
  currency,
  labelKey = "name",
}: {
  active?: boolean;
  payload?: { payload?: Record<string, unknown>; name?: string; value?: number; dataKey?: string }[];
  currency: string;
  labelKey?: string;
}) {
  if (!active || !payload?.[0]) return null;
  const row = payload[0].payload ?? {};
  const dataKey = String(payload[0].dataKey ?? "");
  const title = String(row[labelKey] ?? payload[0].name ?? "");
  const value =
    typeof payload[0].value === "number"
      ? payload[0].value
      : typeof row.value === "number"
        ? row.value
        : null;

  let items: OverlayItem[] | undefined;
  if (dataKey === "income" && Array.isArray(row.incomeItems)) {
    items = row.incomeItems as OverlayItem[];
  } else if (dataKey === "expense" && Array.isArray(row.expenseItems)) {
    items = row.expenseItems as OverlayItem[];
  } else if (Array.isArray(row.items)) {
    items = row.items as OverlayItem[];
  }

  return (
    <div
      className="max-w-xs rounded-xl border border-rim bg-overlay px-3 py-2 text-xs shadow-lg"
      style={{ color: "var(--fg)" }}
    >
      <p className="font-semibold text-fg">
        {title}
        {value != null ? (
          <span className="ml-2 tabular-nums text-fg-muted">
            {formatMajor(value, currency)}
          </span>
        ) : null}
      </p>
      {items && items.length > 0 ? (
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto border-t border-rim-subtle pt-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex justify-between gap-3 text-fg-muted"
            >
              <span className="min-w-0 truncate">
                {item.date ? `${item.date} · ` : ""}
                {item.label}
              </span>
              <span className="shrink-0 tabular-nums text-fg">
                {formatMajor(item.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-fg-subtle">No line details</p>
      )}
    </div>
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
  const [colors, setColors] = useState<ChartColors>(FALLBACK);
  useEffect(() => {
    setColors(readThemeColors());
  }, []);

  const tick = { fontSize: 11, fill: colors.muted };
  const gridStroke = colors.rim;
  const receipt = receiptSpending ?? [];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:gap-6">
      <section className={`${cardClass} p-4 md:col-span-1`}>
        <h2 className="text-sm font-semibold text-fg">Spending by category</h2>
        {spending.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No spending yet"
            description="Categorized outflows will show up here."
          />
        ) : (
          <div className="mt-2 h-72 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={spending}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {spending.map((_, i) => (
                    <Cell key={i} fill={colors.slices[i % colors.slices.length]} />
                  ))}
                </Pie>
                <Tooltip content={<OverlayTooltip currency={currency} />} />
                <Legend wrapperStyle={{ fontSize: 12, color: colors.muted }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold text-fg">Spending by payee</h2>
        {payees.length === 0 ? (
          <EmptyState icon={BarChart3} title="No payee data yet" />
        ) : (
          <div className="mt-2 h-72 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={payees} layout="vertical" margin={{ left: 4, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.35} />
                <XAxis type="number" tick={tick} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={100}
                  tick={{ ...tick, fontSize: 10 }}
                />
                <Tooltip content={<OverlayTooltip currency={currency} />} />
                <Bar dataKey="value" fill={colors.accent} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold text-fg">Income vs Expense</h2>
        <div className="mt-2 h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incomeExpense}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.35} />
              <XAxis dataKey="month" tick={tick} />
              <YAxis tick={tick} />
              <Tooltip
                content={<OverlayTooltip currency={currency} labelKey="month" />}
              />
              <Legend />
              <Bar dataKey="income" fill={colors.ok} name="Income" />
              <Bar dataKey="expense" fill={colors.danger} name="Expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold text-fg">Net worth</h2>
        <div className="mt-2 h-64 w-full sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={netWorth}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.35} />
              <XAxis dataKey="month" tick={tick} />
              <YAxis tick={tick} />
              <Tooltip
                contentStyle={{
                  background: "var(--overlay)",
                  border: "1px solid var(--rim)",
                  borderRadius: 12,
                  color: "var(--fg)",
                }}
              />
              <Legend />
              <Line type="monotone" dataKey="assets" stroke="#3b82f6" name="Assets" />
              <Line type="monotone" dataKey="debts" stroke={colors.danger} name="Debts" />
              <Line
                type="monotone"
                dataKey="net"
                stroke={colors.accent}
                name="Net"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {receipt.length > 0 ? (
        <>
          <section className={`${cardClass} p-4`}>
            <h2 className="text-sm font-semibold text-fg">
              Receipt-detailed by category
            </h2>
            <p className="mt-1 text-xs text-fg-muted">
              Line items from bill scans — hover for top products.
            </p>
            <div className="mt-2 h-72 w-full sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={receipt}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {receipt.map((_, i) => (
                      <Cell
                        key={i}
                        fill={colors.slices[i % colors.slices.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<OverlayTooltip currency={currency} />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: colors.muted }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className={`${cardClass} p-4`}>
            <h2 className="text-sm font-semibold text-fg">
              Receipt categories (bars)
            </h2>
            <div className="mt-2 h-72 w-full sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={receipt.slice(0, 10)}
                  layout="vertical"
                  margin={{ left: 4, right: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={gridStroke}
                    opacity={0.35}
                  />
                  <XAxis type="number" tick={tick} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ ...tick, fontSize: 10 }}
                  />
                  <Tooltip content={<OverlayTooltip currency={currency} />} />
                  <Bar
                    dataKey="value"
                    fill={colors.ok}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
