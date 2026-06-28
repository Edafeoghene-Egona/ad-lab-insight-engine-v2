import { ratePct } from "@/lib/creativeos";
import type { Creative } from "@/lib/creativeos-types";

const COLS = ["Impression", "25%", "50%", "75%", "100%"];

// Green (held) → red (lost) by retention %.
function heatColor(v: number): string {
  if (v >= 70) return "#16C784";
  if (v >= 45) return "#A7D84B";
  if (v >= 28) return "#F5A623";
  if (v >= 15) return "#F47C3C";
  return "#F4476B";
}

/** Heatmap of where each creative loses viewers, by quartile checkpoint. */
export function DropoffMap({ creatives, onOpen }: { creatives: Creative[]; onOpen?: (c: Creative) => void }) {
  const rows = creatives.filter((c) => c.quartiles).sort((a, b) => b.viewRate - a.viewRate).slice(0, 14);
  if (!rows.length) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid items-center gap-1.5" style={{ gridTemplateColumns: "220px repeat(5, 1fr)" }}>
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Creative</div>
        {COLS.map((c) => (
          <div key={c} className="text-[10px] uppercase tracking-wider text-slate-400 font-bold text-center">
            {c}
          </div>
        ))}
      </div>
      {rows.map((c, i) => {
        const q = c.quartiles!;
        const cells = [100, ratePct(q.p25), ratePct(q.p50), ratePct(q.p75), ratePct(q.p100)];
        return (
          <div
            key={c.videoId ?? i}
            className="grid items-center gap-1.5"
            style={{ gridTemplateColumns: "220px repeat(5, 1fr)" }}
          >
            <button
              type="button"
              onClick={() => onOpen?.(c)}
              className="text-left text-[11px] font-semibold text-slate-700 truncate hover:text-indigo-600"
              title={c.title}
            >
              {c.title}
            </button>
            {cells.map((v, j) => (
              <div
                key={j}
                title={`${v.toFixed(0)}% watching`}
                className="h-9 rounded-md flex items-center justify-center text-[11px] font-bold text-slate-900/70"
                style={{ background: heatColor(v) }}
              >
                {v.toFixed(0)}%
              </div>
            ))}
          </div>
        );
      })}
      <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
        Held
        <div className="flex rounded overflow-hidden">
          {["#16C784", "#A7D84B", "#F5A623", "#F47C3C", "#F4476B"].map((c) => (
            <div key={c} className="w-6 h-2.5" style={{ background: c }} />
          ))}
        </div>
        Lost
      </div>
    </div>
  );
}
