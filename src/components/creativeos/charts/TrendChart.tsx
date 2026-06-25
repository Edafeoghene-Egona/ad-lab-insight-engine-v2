import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtCompact, fmtMoney } from "@/lib/creativeos";
import type { DailyPoint } from "@/lib/creativeos-types";

const shortDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleString("en-US", { month: "short", day: "numeric" });
};

/** Dual-axis daily views vs spend. */
export function ViewsSpendTrend({ daily }: { daily: DailyPoint[] }) {
  const data = daily.map((d) => ({ ...d, label: shortDate(d.date) }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="rgba(0,0,0,0.05)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis
          yAxisId="v"
          tickFormatter={(v) => fmtCompact(v)}
          tick={{ fontSize: 10, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="s"
          orientation="right"
          tickFormatter={(v) => fmtMoney(v)}
          tick={{ fontSize: 10, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        <Area
          yAxisId="v"
          type="monotone"
          dataKey="views"
          name="Views"
          stroke="#6366f1"
          fill="rgba(99,102,241,0.08)"
          strokeWidth={2.5}
        />
        <Line yAxisId="s" type="monotone" dataKey="spend" name="Spend" stroke="#f43f5e" strokeWidth={2.5} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Single-metric daily area chart (view rate or conversions). */
export function MetricTrend({
  daily,
  dataKey,
  color,
  asPercent,
}: {
  daily: DailyPoint[];
  dataKey: "viewRate" | "conversions";
  color: string;
  asPercent?: boolean;
}) {
  const data = daily.map((d) => ({
    label: shortDate(d.date),
    value: asPercent ? +(d.viewRate <= 1 ? d.viewRate * 100 : d.viewRate).toFixed(1) : d[dataKey],
  }));
  return (
    <ResponsiveContainer width="100%" height={210}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="rgba(0,0,0,0.05)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => (asPercent ? `${v}%` : String(v))}
          tick={{ fontSize: 10, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v: number) => (asPercent ? `${v}%` : v)}
          contentStyle={{ borderRadius: 8, fontSize: 12 }}
        />
        <Area type="monotone" dataKey="value" stroke={color} fill={`${color}14`} strokeWidth={2.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
