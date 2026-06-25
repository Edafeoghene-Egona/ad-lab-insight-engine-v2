import { Play, X, Youtube } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { RetentionCurve } from "./charts/RetentionCurve";
import { fmtCompact, fmtCpv, fmtMoney, ratePct } from "@/lib/creativeos";
import type { Creative } from "@/lib/creativeos-types";

const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const thumbUrl = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

function Cell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg px-2.5 py-2">
      <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{label}</p>
      <p className={`cos-display text-base font-bold mt-0.5 tabular-nums ${accent ?? "text-slate-800"}`}>{value}</p>
    </div>
  );
}

/** Slide-out detail panel for one creative. Rendered at the page root; null when closed. */
export function CreativeDrawer({ creative, onClose }: { creative: Creative | null; onClose: () => void }) {
  if (!creative) return null;
  const c = creative;
  const dur = c.durationSec != null ? `${Math.floor(c.durationSec / 60)}:${String(c.durationSec % 60).padStart(2, "0")}` : "—";

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-[440px] max-w-[92vw] h-full bg-white border-l border-slate-200 shadow-2xl overflow-y-auto cos-reveal">
        <div
          className="relative h-44 flex items-center justify-center overflow-hidden"
          style={{ background: "linear-gradient(135deg,#1e293b 0%,#4338ca 100%)" }}
        >
          {c.videoId ? (
            <img src={thumbUrl(c.videoId)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-90" />
          ) : null}
          <span className="relative w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
            <Play className="w-6 h-6 text-white" fill="white" />
          </span>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-lg bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
          >
            <X className="w-4 h-4" />
          </button>
          <span className="absolute top-3.5 left-3.5">
            <StatusBadge status={c.status} />
          </span>
        </div>

        <div className="p-5">
          <h2 className="cos-display text-lg font-bold text-slate-900 leading-snug">{c.title}</h2>
          <p className="text-xs text-slate-400 mt-1">{c.format} · {dur}</p>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <Cell label="VVR" value={ratePct(c.viewRate).toFixed(1) + "%"} />
            <Cell label="Hook" value={c.quartiles ? ratePct(c.quartiles.p25).toFixed(1) + "%" : "—"} accent="text-indigo-600" />
            <Cell label="Completion" value={c.quartiles ? ratePct(c.quartiles.p100).toFixed(1) + "%" : "—"} />
            <Cell label="Views" value={fmtCompact(c.views)} />
            <Cell label="Impressions" value={fmtCompact(c.impressions)} />
            <Cell label="CPV" value={fmtCpv(c.avgCpv)} />
            <Cell label="Conversions" value={c.conversions.toFixed(1)} accent="text-emerald-600" />
            <Cell label="Conv. value" value={fmtMoney(c.conversionsValue)} />
            <Cell label="Spend" value={fmtMoney(c.cost)} />
          </div>

          {c.quartiles && (
            <>
              <p className="text-sm font-bold text-slate-700 mt-5 mb-1">Retention curve</p>
              <RetentionCurve creatives={[c]} />
            </>
          )}

          {c.videoId && (
            <a
              href={watchUrl(c.videoId)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Youtube className="w-4 h-4" /> Watch on YouTube
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
