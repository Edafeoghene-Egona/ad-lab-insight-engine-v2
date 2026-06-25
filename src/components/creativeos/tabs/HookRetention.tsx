import { GlassPanel } from "../GlassPanel";
import { StatCard } from "../StatCard";
import { EmptyState } from "../states";
import { RetentionCurve } from "../charts/RetentionCurve";
import { HookRanking } from "../charts/HookRanking";
import { QuartileFunnel } from "../charts/QuartileFunnel";
import { ratePct } from "@/lib/creativeos";
import type { ClientResponse } from "@/lib/creativeos-types";

function PanelTitle({ title, badge }: { title: string; badge?: string }) {
  return (
    <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4 flex justify-between items-center">
      {title}
      {badge && <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-1 rounded text-slate-500">{badge}</span>}
    </h3>
  );
}

export function HookRetention({ data }: { data: ClientResponse }) {
  const withQ = data.creatives.filter((c) => c.quartiles);
  const noQ = data.creatives.length - withQ.length;

  // Account-average quartile funnel.
  const avg = (pick: (q: NonNullable<ClientResponse["creatives"][number]["quartiles"]>) => number) =>
    withQ.length ? withQ.reduce((s, c) => s + pick(c.quartiles!), 0) / withQ.length : 0;

  const funnel = [
    { label: "Hook 25%", value: avg((q) => q.p25), color: "#6366f1" },
    { label: "Midpoint 50%", value: avg((q) => q.p50), color: "#8b5cf6" },
    { label: "Third quartile 75%", value: avg((q) => q.p75), color: "#c13fe0" },
    { label: "Completion 100%", value: avg((q) => q.p100), color: "#10b981" },
  ];

  const top5 = [...withQ].sort((a, b) => b.viewRate - a.viewRate).slice(0, 5);

  if (withQ.length === 0) {
    return (
      <EmptyState
        title="No quartile retention data in this window"
        hint="Video quartile metrics weren’t returned for these creatives (common for Demand Gen). Other metrics are available in the Creative Testing Lab."
      />
    );
  }

  return (
    <div className="cos-reveal flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {funnel.map((f) => (
          <StatCard key={f.label} label={f.label} value={ratePct(f.value).toFixed(1) + "%"} foot="account avg" />
        ))}
      </div>

      {noQ > 0 && (
        <p className="text-xs text-slate-400 -mt-2">
          {noQ} creative(s) without quartile data (Demand Gen) are excluded from the retention visuals below.
        </p>
      )}

      <GlassPanel className="p-6">
        <PanelTitle title="Average quartile funnel" badge="Account" />
        <QuartileFunnel rows={funnel} />
      </GlassPanel>

      <GlassPanel className="p-6">
        <PanelTitle title="Audience retention curve" badge="Top 5 by view rate" />
        <RetentionCurve creatives={top5} />
      </GlassPanel>

      <GlassPanel className="p-6">
        <PanelTitle title="Hook rate by creative" badge={`Floor ${ratePct(data.benchmarks.hook).toFixed(1)}%`} />
        <p className="text-xs text-slate-400 mb-4 -mt-2">Creatives below the account hook floor are flagged coral.</p>
        <HookRanking creatives={withQ} floor={data.benchmarks.hook} />
      </GlassPanel>
    </div>
  );
}
