import { useMemo, useState } from "react";
import { GlassPanel } from "../GlassPanel";
import { CreativeCard } from "../CreativeCard";
import { StatusBadge } from "../StatusBadge";
import { matchesStatus, type StatusFilter } from "../CreativeOSFilterBar";
import { fmtCompact, fmtCpv, ratePct } from "@/lib/creativeos";
import type { ClientResponse, Creative } from "@/lib/creativeos-types";
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

export function CreativeLab({
  data,
  statusFilter,
  search,
}: {
  data: ClientResponse;
  statusFilter: StatusFilter;
  search: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("viewRate");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const top3 = useMemo(
    () => [...data.creatives].sort((a, b) => b.viewRate - a.viewRate).slice(0, 3),
    [data.creatives],
  );

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return data.creatives
      .filter((c) => matchesStatus(c.status, statusFilter))
      .filter((c) => !q || c.title.toLowerCase().includes(q))
      .sort((a, b) => (dir === "desc" ? sortVal(b, sortKey) - sortVal(a, sortKey) : sortVal(a, sortKey) - sortVal(b, sortKey)));
  }, [data.creatives, statusFilter, search, sortKey, dir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(k);
      setDir("desc");
    }
  };

  const benchHook = ratePct(data.benchmarks.hook);
  const benchVvr = ratePct(data.benchmarks.viewRate);

  return (
    <div className="cos-reveal flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {top3.map((c, i) => (
          <CreativeCard key={c.videoId ?? i} creative={c} rank={i + 1} />
        ))}
      </div>

      <GlassPanel className="overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="cos-display font-semibold text-slate-800 text-sm uppercase tracking-wider">
            Creative Leaderboard
          </h3>
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
                    <button
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-indigo-600"
                    >
                      {col.label}
                      {sortKey === col.key && <span className="text-indigo-500">{dir === "desc" ? "↓" : "↑"}</span>}
                    </button>
                  </th>
                ))}
                <th className="px-4 py-3.5 text-center">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {rows.map((c, i) => {
                const hook = c.quartiles ? ratePct(c.quartiles.p25) : null;
                const compl = c.quartiles ? ratePct(c.quartiles.p100) : null;
                const vvr = ratePct(c.viewRate);
                return (
                  <tr key={c.videoId ?? i} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-sm text-slate-800 leading-tight line-clamp-1">{c.title}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{c.format}</p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{fmtCompact(c.impressions)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-600">{fmtCompact(c.views)}</td>
                    <td className={cn("px-4 py-3 text-right tabular-nums font-semibold", vvr < benchVvr ? "text-rose-600" : "text-slate-700")}>
                      {vvr.toFixed(1)}%
                    </td>
                    <td className={cn("px-4 py-3 text-right tabular-nums", hook == null ? "text-slate-300" : hook < benchHook ? "text-rose-600 font-bold" : "text-slate-600")}>
                      {hook == null ? "—" : hook.toFixed(1) + "%"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">
                      {compl == null ? "—" : compl.toFixed(1) + "%"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-500">{fmtCpv(c.avgCpv)}</td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-700">
                      {c.conversions.toFixed(0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={c.status} />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-10 text-center text-sm text-slate-400">
                    No creatives match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  );
}
