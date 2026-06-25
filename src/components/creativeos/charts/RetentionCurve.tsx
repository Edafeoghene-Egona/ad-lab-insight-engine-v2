import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ratePct } from "@/lib/creativeos";
import type { Creative } from "@/lib/creativeos-types";

const LINE_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6"];

/** % of viewers still watching at each quartile, for the top creatives. */
export function RetentionCurve({ creatives }: { creatives: Creative[] }) {
  const withQuartiles = creatives.filter((c) => c.quartiles);
  const series = withQuartiles.slice(0, 5);

  // One row per quartile checkpoint; one key per creative.
  const points = ["Impression", "25%", "50%", "75%", "100%"].map((label, i) => {
    const row: Record<string, number | string> = { stage: label };
    series.forEach((c, idx) => {
      const q = c.quartiles!;
      row[`c${idx}`] = i === 0 ? 100 : ratePct([q.p25, q.p50, q.p75, q.p100][i - 1]);
    });
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={points} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid stroke="rgba(0,0,0,0.05)" vertical={false} />
        <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
        {series.map((c, idx) => (
          <Line
            key={idx}
            type="monotone"
            dataKey={`c${idx}`}
            name={c.title.length > 24 ? c.title.slice(0, 24) + "…" : c.title}
            stroke={LINE_COLORS[idx % LINE_COLORS.length]}
            strokeWidth={2.5}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
