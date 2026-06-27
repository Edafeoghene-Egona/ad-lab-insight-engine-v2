import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ratePct } from "@/lib/creativeos";
import type { Creative } from "@/lib/creativeos-types";

/** Horizontal hook-rate (p25) ranking; bars below the benchmark turn coral. */
export function HookRanking({ creatives, floor }: { creatives: Creative[]; floor: number }) {
  const floorPct = ratePct(floor);
  const data = creatives
    .filter((c) => c.quartiles)
    .map((c) => ({
      name: c.title.length > 28 ? c.title.slice(0, 28) + "…" : c.title,
      hook: +ratePct(c.quartiles!.p25).toFixed(1),
    }))
    .sort((a, b) => b.hook - a.hook);

  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 8, bottom: 4 }}>
        <CartesianGrid stroke="rgba(0,0,0,0.05)" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 10, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={150}
          tick={{ fontSize: 10, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip formatter={(v: number) => `${v}% hook rate`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="hook" radius={[0, 4, 4, 0]} barSize={16}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.hook < floorPct ? "#f43f5e" : "#6366f1"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
