import { useMemo, useState } from "react";
import { Check, Plus, X, Youtube } from "lucide-react";
import { GlassPanel } from "../GlassPanel";
import { CreativeCard } from "../CreativeCard";
import { StatusBadge } from "../StatusBadge";
import { RetentionCurve } from "../charts/RetentionCurve";
import { matchesStatus, type StatusFilter } from "../CreativeOSFilterBar";
import { CosButton } from "../CosButton";
import { statusLabel, fmtCompact, fmtCpv, ratePct } from "@/lib/creativeos";
import type { ClientResponse, Creative, CreativeStatus } from "@/lib/creativeos-types";
import { cn } from "@/lib/utils";

type SortKey = "impressions" | "views" | "viewRate" | "hook" | "compl" | "avgCpv" | "conversions";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "impressions", label: "Impr" },
  { key: "views", label: "Views" },
  { key: "viewRate", label: "VVR" },
  { key: "hook", label: "Hook" },
  { key: "compl", label: "Compl" },
  { key: "avgCpv", label: "CPV" },
  { key: "conversions", label: "Conv" },
];

const sortVal = (c: Creative, k: SortKey): number => {
  if (k === "hook") return c.quartiles?.p25 ?? -1;
  if (k === "compl") return c.quartiles?.p100 ?? -1;
  return c[k];
};
const keyOf = (c: Creative, i: number) => c.videoId ?? `idx-${i}`;
const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** Compact YouTube icon-link; stops propagation so it doesn't trigger the row's drawer. */
function WatchLink({ creative }: { creative: Creative }) {
  if (!creative.videoId) return <span className="text-slate-300">—</span>;
  return (
    <a
      href={watchUrl(creative.videoId)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={`Watch ${creative.title} on YouTube`}
      title="Watch on YouTube"
      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-red-600 hover:bg-red-50 transition-colors"
    >
      <Youtube className="w-4 h-4" />
    </a>
  );
}

// ── Leaderboard ───────────────────────────────────────────────────────────────
function Leaderboard({
  data,
  statusFilter,
  search,
  onOpenCreative,
}: {
  data: ClientResponse;
  statusFilter: StatusFilter;
  search: string;
  onOpenCreative: (c: Creative) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("viewRate");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  // Hero cards track the active Win/Test/Retire filter + search, so "top creatives"
  // always reflects the current view rather than the global top-by-VVR.
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.creatives
      .filter((c) => matchesStatus(c.status, statusFilter))
      .filter((c) => !q || c.title.toLowerCase().includes(q));
  }, [data.creatives, statusFilter, search]);
  const top3 = useMemo(() => [...filtered].sort((a, b) => b.viewRate - a.viewRate).slice(0, 3), [filtered]);
  const rows = useMemo(
    () =>
      [...filtered].sort((a, b) =>
        dir === "desc" ? sortVal(b, sortKey) - sortVal(a, sortKey) : sortVal(a, sortKey) - sortVal(b, sortKey),
      ),
    [filtered, sortKey, dir],
  );

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(k); setDir("desc"); }
  };
  const benchHook = ratePct(data.benchmarks.hook);
  const benchVvr = ratePct(data.benchmarks.viewRate);

  return (
    <div className="cos-reveal flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {top3.map((c, i) => (
          <CreativeCard key={keyOf(c, i)} creative={c} rank={i + 1} onOpen={() => onOpenCreative(c)} />
        ))}
      </div>
      <GlassPanel className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="cos-display font-semibold text-slate-800 text-sm uppercase tracking-wider">Creative Leaderboard</h3>
          <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-1 rounded font-bold uppercase tracking-wider">
            {rows.length} creatives
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
              <tr>
                <th className="px-5 py-3.5">Creative</th>
                {COLUMNS.map((col) => (
                  <th key={col.key} className="px-4 py-3.5 text-right">
                    <button type="button" onClick={() => toggleSort(col.key)} className="inline-flex items-center gap-1 hover:text-indigo-600">
                      {col.label}
                      {sortKey === col.key && <span className="text-indigo-500">{dir === "desc" ? "↓" : "↑"}</span>}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3.5 text-center">Result</th>
                <th className="px-4 py-3.5 text-center">Watch</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((c, i) => {
                const hook = c.quartiles ? ratePct(c.quartiles.p25) : null;
                const compl = c.quartiles ? ratePct(c.quartiles.p100) : null;
                const vvr = ratePct(c.viewRate);
                return (
                  <tr key={keyOf(c, i)} onClick={() => onOpenCreative(c)} className="hover:bg-slate-50/70 transition-colors cursor-pointer">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-sm text-slate-800 leading-tight line-clamp-1">{c.title}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{c.format}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{fmtCompact(c.impressions)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{fmtCompact(c.views)}</td>
                    <td className={cn("px-4 py-3 text-right tabular-nums font-semibold", vvr < benchVvr ? "text-rose-600" : "text-slate-700")}>{vvr.toFixed(1)}%</td>
                    <td className={cn("px-4 py-3 text-right tabular-nums", hook == null ? "text-slate-300" : hook < benchHook ? "text-rose-600 font-bold" : "text-slate-600")}>{hook == null ? "—" : hook.toFixed(1) + "%"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{compl == null ? "—" : compl.toFixed(1) + "%"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{fmtCpv(c.avgCpv)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-700">{c.conversions.toFixed(0)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 text-center"><WatchLink creative={c} /></td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={10} className="px-5 py-10 text-center text-sm text-slate-400">No creatives match the current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}

// ── Test Pipeline (status board) ───────────────────────────────────────────────
const PIPELINE: { status: CreativeStatus; tint: string; dot: string }[] = [
  { status: "win", tint: "bg-emerald-50", dot: "#10b981" },
  { status: "test", tint: "bg-violet-50", dot: "#8b5cf6" },
  { status: "loss", tint: "bg-rose-50", dot: "#f43f5e" },
];

function TestPipeline({ data, onOpenCreative }: { data: ClientResponse; onOpenCreative: (c: Creative) => void }) {
  return (
    <div className="cos-reveal flex flex-col gap-4">
      <p className="text-sm text-slate-500">
        Creatives grouped by computed result. <span className="text-slate-700 font-semibold">↳ Scale winners, re-cut tests, retire losers.</span>
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        {PIPELINE.map((col) => {
          const items = data.creatives.filter((c) => c.status === col.status);
          return (
            <div key={col.status ?? "none"} className={cn("rounded-2xl border border-slate-200 p-3", col.tint)}>
              <div className="flex items-center justify-between px-1 mb-3">
                <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <span className="w-2 h-2 rounded-full" style={{ background: col.dot }} />
                  {statusLabel(col.status)}
                </span>
                <span className="text-xs text-slate-400 font-bold">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((c, i) => (
                  <div
                    key={keyOf(c, i)}
                    className="relative bg-white border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenCreative(c)}
                      className="block w-full text-left p-3 pr-9"
                    >
                      <div className="text-[13px] font-semibold text-slate-800 leading-tight line-clamp-2">{c.title}</div>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                        <span>VVR {ratePct(c.viewRate).toFixed(1)}%</span>
                        <span>{fmtCpv(c.avgCpv)}</span>
                        <span>{c.conversions.toFixed(0)} conv</span>
                      </div>
                    </button>
                    <span className="absolute top-2 right-2">
                      <WatchLink creative={c} />
                    </span>
                  </div>
                ))}
                {items.length === 0 && <p className="text-xs text-slate-400 px-1 py-2">None.</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Compare ───────────────────────────────────────────────────────────────────
const CMP_ROWS: { label: string; get: (c: Creative) => number; fmt: (v: number) => string; lowerBetter?: boolean }[] = [
  { label: "View rate", get: (c) => ratePct(c.viewRate), fmt: (v) => v.toFixed(1) + "%" },
  { label: "Hook", get: (c) => (c.quartiles ? ratePct(c.quartiles.p25) : -1), fmt: (v) => (v < 0 ? "—" : v.toFixed(1) + "%") },
  { label: "Completion", get: (c) => (c.quartiles ? ratePct(c.quartiles.p100) : -1), fmt: (v) => (v < 0 ? "—" : v.toFixed(1) + "%") },
  { label: "CPV", get: (c) => c.avgCpv, fmt: (v) => fmtCpv(v), lowerBetter: true },
  { label: "Conversions", get: (c) => c.conversions, fmt: (v) => v.toFixed(0) },
  { label: "Views", get: (c) => c.views, fmt: (v) => fmtCompact(v) },
];

function Compare({ data, onOpenCreative }: { data: ClientResponse; onOpenCreative: (c: Creative) => void }) {
  const top = [...data.creatives].sort((a, b) => b.viewRate - a.viewRate);
  const [selected, setSelected] = useState<string[]>(() => top.slice(0, 3).map((c, i) => keyOf(c, i)));
  const [picking, setPicking] = useState(false);

  const byKey = new Map(data.creatives.map((c, i) => [keyOf(c, i), c]));
  const chosen = selected.map((k) => byKey.get(k)).filter(Boolean) as Creative[];

  const best = (r: (typeof CMP_ROWS)[number]) => {
    const vals = chosen.map(r.get).filter((v) => v >= 0);
    if (!vals.length) return null;
    return r.lowerBetter ? Math.min(...vals) : Math.max(...vals);
  };

  return (
    <div className="cos-reveal flex flex-col gap-5">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-slate-500">Comparing {chosen.length} creative(s).</span>
        <div className="flex-1" />
        <CosButton variant="outline" onClick={() => setPicking((p) => !p)}>
          <Plus className="w-3.5 h-3.5" /> Add / remove
        </CosButton>
      </div>

      {picking && (
        <GlassPanel className="p-3 max-h-56 overflow-y-auto flex flex-col gap-1">
          {top.map((c, i) => {
            const k = keyOf(c, i);
            const on = selected.includes(k);
            const full = selected.length >= 4 && !on;
            return (
              <button
                key={k}
                type="button"
                disabled={full}
                onClick={() => setSelected((s) => (on ? s.filter((x) => x !== k) : [...s, k]))}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs hover:bg-slate-50",
                  on && "bg-indigo-50",
                  full && "opacity-40 cursor-not-allowed",
                )}
              >
                <span className={cn("w-4 h-4 rounded border flex items-center justify-center", on ? "bg-indigo-600 border-indigo-600" : "border-slate-300")}>
                  {on && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="font-semibold text-slate-700 truncate flex-1">{c.title}</span>
                <StatusBadge status={c.status} />
              </button>
            );
          })}
        </GlassPanel>
      )}

      {chosen.length > 0 ? (
        <>
          <GlassPanel className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-[10px] uppercase tracking-wider text-slate-400 font-bold">Metric</th>
                  {chosen.map((c, i) => (
                    <th key={keyOf(c, i)} className="px-4 py-3 text-left">
                      <button type="button" onClick={() => onOpenCreative(c)} className="flex flex-col gap-1 hover:text-indigo-600">
                        <span className="text-xs font-bold text-slate-800 line-clamp-1 max-w-[160px]">{c.title}</span>
                        <StatusBadge status={c.status} />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {CMP_ROWS.map((r) => {
                  const b = best(r);
                  return (
                    <tr key={r.label}>
                      <td className="px-4 py-3 text-[13px] text-slate-500">{r.label}</td>
                      {chosen.map((c, i) => {
                        const v = r.get(c);
                        const isBest = b != null && v === b && v >= 0;
                        return (
                          <td key={keyOf(c, i)} className={cn("px-4 py-3 text-sm font-bold tabular-nums", isBest ? "text-emerald-600" : "text-slate-700")}>
                            <span className="inline-flex items-center gap-1.5">
                              {r.fmt(v)}
                              {isBest && <Check className="w-3.5 h-3.5" />}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </GlassPanel>
          {chosen.some((c) => c.quartiles) && (
            <GlassPanel className="p-6">
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">Retention curves overlaid</h3>
              <RetentionCurve creatives={chosen} />
            </GlassPanel>
          )}
        </>
      ) : (
        <GlassPanel className="py-12 text-center text-sm text-slate-400 border-2 border-dashed border-slate-200 bg-transparent shadow-none">
          <X className="w-5 h-5 mx-auto mb-2 text-slate-300" />
          Pick creatives to compare with “Add / remove”.
        </GlassPanel>
      )}
    </div>
  );
}

export function CreativeLab({
  data,
  sub,
  statusFilter,
  search,
  onOpenCreative,
}: {
  data: ClientResponse;
  sub: string;
  statusFilter: StatusFilter;
  search: string;
  onOpenCreative: (c: Creative) => void;
}) {
  if (sub === "Test Pipeline") return <TestPipeline data={data} onOpenCreative={onOpenCreative} />;
  if (sub === "Compare") return <Compare data={data} onOpenCreative={onOpenCreative} />;
  return <Leaderboard data={data} statusFilter={statusFilter} search={search} onOpenCreative={onOpenCreative} />;
}
