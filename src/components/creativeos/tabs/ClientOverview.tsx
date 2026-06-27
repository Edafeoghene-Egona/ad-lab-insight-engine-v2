import { DollarSign, Play, Trophy, Trash2, TrendingUp, Target } from "lucide-react";
import { GlassPanel } from "../GlassPanel";
import { StatCard } from "../StatCard";
import { CreativeCard } from "../CreativeCard";
import { ViewsSpendTrend } from "../charts/TrendChart";
import { fmtCompact, fmtMoney, ratePct } from "@/lib/creativeos";
import type { ClientResponse, Creative, DateRange } from "@/lib/creativeos-types";

const fmtRange = (w: DateRange) => {
  const f = (iso: string) => new Date(iso + "T00:00:00").toLocaleString("en-US", { month: "short", day: "numeric" });
  return `${f(w.start)} – ${f(w.end)}`;
};
const fmtRoas = (r: number | null) => (r == null ? "—" : r.toFixed(2) + "×");

/**
 * Single-client summary for the shared deep-dive landing tab.
 * Built entirely from this client's own ClientResponse — no portfolio data.
 */
export function ClientOverview({
  data,
  onOpenCreative,
}: {
  data: ClientResponse;
  onOpenCreative: (c: Creative) => void;
}) {
  const cr = data.creatives;
  const totalViews = cr.reduce((s, c) => s + c.views, 0);
  const totalSpend = cr.reduce((s, c) => s + c.cost, 0);
  const totalConversions = cr.reduce((s, c) => s + c.conversions, 0);
  const totalConvValue = cr.reduce((s, c) => s + c.conversionsValue, 0);
  const blendedRoas = totalSpend > 0 && totalConvValue > 0 ? totalConvValue / totalSpend : null;

  const win = cr.filter((c) => c.status === "win").length;
  const test = cr.filter((c) => c.status === "test").length;
  const loss = cr.filter((c) => c.status === "loss").length;
  const classified = win + test + loss;
  const winRate = classified ? Math.round((win / classified) * 100) : 0;

  const top3 = [...cr].sort((a, b) => b.viewRate - a.viewRate).slice(0, 3);

  return (
    <div className="cos-reveal flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="h-px w-8 bg-indigo-500" />
        <div>
          <h2 className="cos-display text-xl font-semibold text-slate-900">Performance overview</h2>
          <p className="text-xs text-slate-500 mt-0.5">{fmtRange(data.window)} · pulled live from Google Ads</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard label="Total views" value={fmtCompact(totalViews)} foot="video + demand gen" icon={Play} />
        <StatCard label="Spend" value={fmtMoney(totalSpend)} foot="selected window" icon={DollarSign} />
        <StatCard
          label="Blended ROAS"
          value={fmtRoas(blendedRoas)}
          foot="conv. value ÷ spend"
          icon={TrendingUp}
          accentClass="text-emerald-600"
        />
        <StatCard
          label="Conversions"
          value={Math.round(totalConversions).toLocaleString()}
          foot="selected window"
          icon={Target}
          accentClass="text-emerald-600"
        />
        <StatCard label="Avg view rate" value={ratePct(data.benchmarks.viewRate).toFixed(1) + "%"} foot="account VVR" />
        <StatCard
          label="Win rate"
          value={winRate + "%"}
          foot={`${classified} classified`}
          icon={Trophy}
          accentClass="text-indigo-600"
        />
      </div>

      <GlassPanel className="p-5 flex flex-wrap items-center gap-x-8 gap-y-3">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Creative results</span>
        <span className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> {win} win
        </span>
        <span className="flex items-center gap-2 text-sm font-semibold text-violet-600">
          <span className="w-2 h-2 rounded-full bg-violet-500" /> {test} test
        </span>
        <span className="flex items-center gap-2 text-sm font-semibold text-rose-600">
          <Trash2 className="w-3.5 h-3.5" /> {loss} retire
        </span>
      </GlassPanel>

      {data.daily.length > 1 && (
        <GlassPanel className="p-6">
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4 flex justify-between items-center">
            Views vs spend
            <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-1 rounded text-slate-500">
              {fmtCompact(totalViews)} views · {fmtMoney(totalSpend)}
            </span>
          </h3>
          <ViewsSpendTrend daily={data.daily} />
        </GlassPanel>
      )}

      {top3.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-indigo-500" />
            <h3 className="cos-display text-lg font-semibold text-slate-900">Top creatives</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {top3.map((c, i) => (
              <CreativeCard key={c.videoId ?? `idx-${i}`} creative={c} rank={i + 1} onOpen={() => onOpenCreative(c)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
