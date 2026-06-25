import { useState } from "react";
import { Play, Youtube } from "lucide-react";
import { GlassPanel } from "./GlassPanel";
import { StatusBadge } from "./StatusBadge";
import { fmtCompact, fmtCpv, ratePct } from "@/lib/creativeos";
import type { Creative } from "@/lib/creativeos-types";

const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const thumbUrl = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">{label}</p>
      <p className={`cos-display text-base font-bold ${accent ?? "text-slate-800"}`}>{value}</p>
    </div>
  );
}

/** A single video creative: YouTube thumbnail + metric grid + watch link.
 *  When `onOpen` is given, the title/metrics area opens the detail drawer. */
export function CreativeCard({ creative, rank, onOpen }: { creative: Creative; rank?: number; onOpen?: () => void }) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const { videoId } = creative;
  const showThumb = videoId && !thumbFailed;

  return (
    <GlassPanel className="cos-creative-card overflow-hidden flex flex-col">
      <a
        href={videoId ? watchUrl(videoId) : undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block w-full aspect-video overflow-hidden"
        style={{ background: "linear-gradient(135deg,#1e293b 0%,#4338ca 100%)" }}
      >
        {showThumb ? (
          <img
            src={thumbUrl(videoId!)}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 w-full h-full text-white/85">
            <Youtube className="w-8 h-8" />
            <span className="text-[10px] font-bold tracking-wider uppercase">Video Preview</span>
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-slate-900/20">
          <span className="w-[54px] h-[54px] rounded-full bg-red-600/90 flex items-center justify-center shadow-lg">
            <Play className="w-5 h-5 text-white" fill="white" />
          </span>
        </span>
        {rank != null && (
          <span className="cos-display absolute top-2.5 left-2.5 w-6 h-6 rounded-md bg-slate-900/80 text-white flex items-center justify-center font-bold text-xs backdrop-blur">
            {rank}
          </span>
        )}
        {creative.durationSec != null && (
          <span className="absolute bottom-2.5 right-2.5 bg-slate-900/80 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded tabular-nums">
            {Math.floor(creative.durationSec / 60)}:{String(creative.durationSec % 60).padStart(2, "0")}
          </span>
        )}
      </a>

      <div className="p-5 flex flex-col flex-grow">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{creative.format}</span>
          <StatusBadge status={creative.status} />
        </div>
        <h3
          className={`cos-display font-bold text-slate-900 text-base leading-snug mb-4 line-clamp-2 ${onOpen ? "cursor-pointer hover:text-indigo-600 transition-colors" : ""}`}
          onClick={onOpen}
        >
          {creative.title}
        </h3>
        <div
          className={`grid grid-cols-3 gap-3 mb-4 ${onOpen ? "cursor-pointer" : ""}`}
          onClick={onOpen}
        >
          <Metric label="VVR" value={ratePct(creative.viewRate).toFixed(1) + "%"} />
          <Metric
            label="Hook"
            value={creative.quartiles ? ratePct(creative.quartiles.p25).toFixed(1) + "%" : "—"}
            accent="text-indigo-600"
          />
          <Metric
            label="Compl"
            value={creative.quartiles ? ratePct(creative.quartiles.p100).toFixed(1) + "%" : "—"}
          />
          <Metric label="Views" value={fmtCompact(creative.views)} />
          <Metric label="CPV" value={fmtCpv(creative.avgCpv)} />
          <Metric label="Conv" value={creative.conversions.toFixed(0)} accent="text-emerald-600" />
        </div>
        {videoId && (
          <a
            href={watchUrl(videoId)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
          >
            <Youtube className="w-4 h-4" /> Watch on YouTube
          </a>
        )}
      </div>
    </GlassPanel>
  );
}
