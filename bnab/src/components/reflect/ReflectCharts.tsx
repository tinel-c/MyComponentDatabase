"use client";

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
import { cardClass } from "@/components/forms/field-classes";

const COLORS = [
  "#10b981",
  "#06b6d4",
  "#8b5cf6",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#84cc16",
  "#ec4899",
  "#14b8a6",
  "#a855f7",
  "#64748b",
  "#eab308",
];

type Slice = { name: string; value: number };

export function ReflectCharts({
  spending,
  payees,
  incomeExpense,
  netWorth,
}: {
  currency: string;
  spending: Slice[];
  payees: Slice[];
  incomeExpense: { month: string; income: number; expense: number; net: number }[];
  netWorth: { month: string; assets: number; debts: number; net: number }[];
}) {
  return (
    <div className="space-y-4">
      <section className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold text-fg">Spending by category</h2>
        {spending.length === 0 ? (
          <p className="mt-6 text-center text-sm text-fg-muted">No spending yet.</p>
        ) : (
          <div className="mt-2 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={spending}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {spending.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) =>
                    typeof v === "number" ? v.toFixed(2) : String(v)
                  }
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold text-fg">Spending by payee</h2>
        <div className="mt-2 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={payees} layout="vertical" margin={{ left: 8, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tick={{ fontSize: 10 }}
              />
              <Tooltip />
              <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold text-fg">Income vs Expense</h2>
        <div className="mt-2 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incomeExpense}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="income" fill="#10b981" name="Income" />
              <Bar dataKey="expense" fill="#f43f5e" name="Expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className={`${cardClass} p-4`}>
        <h2 className="text-sm font-semibold text-fg">Net worth</h2>
        <div className="mt-2 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={netWorth}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="assets" stroke="#3b82f6" name="Assets" />
              <Line type="monotone" dataKey="debts" stroke="#f43f5e" name="Debts" />
              <Line type="monotone" dataKey="net" stroke="#10b981" name="Net" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
