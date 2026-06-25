import { ratePct } from "@/lib/creativeos";

interface FunnelRow {
  label: string;
  /** account-average rate (0..1 or 0..100, auto-detected) */
  value: number;
  color: string;
}

/** Average quartile funnel as proportional horizontal bars. */
export function QuartileFunnel({ rows }: { rows: FunnelRow[] }) {
  const top = ratePct(rows[0]?.value ?? 0) || 1;
  return (
    <div className="flex flex-col gap-2.5 py-1">
      {rows.map((r) => {
        const pct = ratePct(r.value);
        const width = Math.max(2, (pct / top) * 100);
        return (
          <div key={r.label} className="grid items-center gap-3" style={{ gridTemplateColumns: "150px 1fr" }}>
            <div className="text-xs text-slate-500">{r.label}</div>
            <div className="h-6 bg-slate-100 rounded-lg overflow-hidden">
              <div
                className="h-full rounded-lg flex items-center justify-end pr-2 text-white text-[11px] font-bold"
                style={{ width: `${width}%`, background: r.color }}
              >
                {pct.toFixed(1)}%
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
