import { GlassPanel } from "../GlassPanel";
import { EmptyState } from "../states";
import { MetricTrend, ViewsSpendTrend } from "../charts/TrendChart";
import { fmtCompact, fmtMoney } from "@/lib/creativeos";
import type { ClientResponse } from "@/lib/creativeos-types";

function PanelTitle({ title, badge }: { title: string; badge: string }) {
  return (
    <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4 flex justify-between items-center">
      {title}
      <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-1 rounded text-slate-500">{badge}</span>
    </h3>
  );
}

export function Trendlines({ data }: { data: ClientResponse }) {
  if (!data.daily.length) {
    return <EmptyState title="No daily data in this window" hint="Try widening the date range." />;
  }
  const totalViews = data.daily.reduce((s, d) => s + d.views, 0);
  const totalSpend = data.daily.reduce((s, d) => s + d.spend, 0);
  const totalConv = data.daily.reduce((s, d) => s + d.conversions, 0);

  return (
    <div className="cos-reveal flex flex-col gap-6">
      <GlassPanel className="p-6">
        <PanelTitle title="Daily views vs spend" badge={`${fmtCompact(totalViews)} views · ${fmtMoney(totalSpend)}`} />
        <ViewsSpendTrend daily={data.daily} />
      </GlassPanel>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassPanel className="p-6">
          <PanelTitle title="Daily view rate" badge="%" />
          <MetricTrend daily={data.daily} dataKey="viewRate" color="#6366f1" asPercent />
        </GlassPanel>
        <GlassPanel className="p-6">
          <PanelTitle title="Daily conversions" badge={`${Math.round(totalConv)} total`} />
          <MetricTrend daily={data.daily} dataKey="conversions" color="#10b981" />
        </GlassPanel>
      </div>
    </div>
  );
}
