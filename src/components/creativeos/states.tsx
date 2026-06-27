import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, SatelliteDish } from "lucide-react";
import { GlassPanel } from "./GlassPanel";

/** Skeleton + "pulling live" indicator shown while a live Google Ads pull runs. */
export function LoadingState({ label = "Pulling live from Google Ads…" }: { label?: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="cos-reveal flex flex-col gap-6">
      <div className="flex items-center gap-3 text-slate-500">
        <SatelliteDish className="w-4 h-4 text-indigo-500 cos-pulse" />
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-slate-400 tabular-nums">{secs}s</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassPanel key={i} className="p-5 h-28 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <GlassPanel key={i} className="h-56 animate-pulse" />
        ))}
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <GlassPanel className="cos-reveal p-10 flex flex-col items-center text-center gap-4 border-l-4 border-l-rose-500">
      <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center">
        <AlertTriangle className="w-5 h-5 text-rose-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">Couldn’t load live data</p>
        <p className="text-xs text-slate-400 mt-1 max-w-md">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </GlassPanel>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <GlassPanel className="cos-reveal py-14 flex flex-col items-center gap-3 text-center border-2 border-dashed border-slate-200 bg-transparent shadow-none">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      {hint && <p className="text-xs text-slate-400 mt-0.5 max-w-md">{hint}</p>}
    </GlassPanel>
  );
}
