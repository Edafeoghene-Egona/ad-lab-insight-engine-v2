import { useState } from "react";
import { GlassPanel } from "../GlassPanel";
import { StatCard } from "../StatCard";
import { EmptyState } from "../states";
import { MetricTrend, ViewsSpendTrend, CustomTrend } from "../charts/TrendChart";
import { fmtCompact, fmtCpv, fmtMoney, ratePct } from "@/lib/creativeos";
import type { ClientResponse } from "@/lib/creativeos-types";

function PanelTitle({ title, badge }: { title: string; badge: string }) {
  return (
    <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4 flex justify-between items-center">
      {title}
      <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-1 rounded text-slate-500">{badge}</span>
    </h3>
  );
}

const METRICS = [
  { key: "views", label: "Views", color: "#6366f1" },
  { key: "spend", label: "Spend", color: "#f43f5e" },
  { key: "viewRate", label: "View rate", color: "#8b5cf6" },
  { key: "conversions", label: "Conversions", color: "#10b981" },
] as const;

export function Trendlines({ data, sub }: { data: ClientResponse; sub: string }) {
  const [metricA, setMetricA] = useState<(typeof METRICS)[number]["key"]>("viewRate");
  const [metricB, setMetricB] = useState<(typeof METRICS)[number]["key"]>("spend");

  if (!data.daily.length) {
    return <EmptyState title="No daily data in this window" hint="Try widening the date range." />;
  }
  const totalViews = data.daily.reduce((s, d) => s + d.views, 0);
  const totalSpend = data.daily.reduce((s, d) => s + d.spend, 0);
  const totalConv = data.daily.reduce((s, d) => s + d.conversions, 0);
  const avgVr = data.daily.reduce((s, d) => s + ratePct(d.viewRate), 0) / data.daily.length;
  const peakVr = Math.max(...data.daily.map((d) => ratePct(d.viewRate)));
  const blendedCpv = totalViews > 0 ? totalSpend / totalViews : 0;

  if (sub === "View Rate") {
    return (
      <div className="cos-reveal flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Avg view rate" value={avgVr.toFixed(1) + "%"} foot="period" accentClass="text-amber-600" />
          <StatCard label="Peak view rate" value={peakVr.toFixed(1) + "%"} foot="best day" accentClass="text-emerald-600" />
          <StatCard label="Days tracked" value={String(data.daily.length)} foot="in window" />
        </div>
        <GlassPanel className="p-6">
          <PanelTitle title="Daily view rate" badge="%" />
          <MetricTrend daily={data.daily} dataKey="viewRate" color="#6366f1" asPercent />
        </GlassPanel>
      </div>
    );
  }

  if (sub === "Conversions") {
    return (
      <div className="cos-reveal flex flex-col gap-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Total conversions" value={Math.round(totalConv).toLocaleString()} foot="period" />
          <StatCard label="Total spend" value={fmtMoney(totalSpend)} foot="period" />
          <StatCard label="Cost / conversion" value={totalConv > 0 ? fmtMoney(totalSpend / totalConv) : "—"} foot="blended" accentClass="text-emerald-600" />
        </div>
        <GlassPanel className="p-6">
          <PanelTitle title="Daily conversions" badge={`${Math.round(totalConv)} total`} />
          <MetricTrend daily={data.daily} dataKey="conversions" color="#10b981" />
        </GlassPanel>
      </div>
    );
  }

  if (sub === "Custom") {
    return (
      <div className="cos-reveal flex flex-col gap-6">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-slate-500">Plot</span>
          <select
            aria-label="First metric"
            value={metricA}
            onChange={(e) => setMetricA(e.target.value as typeof metricA)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-indigo-600 outline-none"
          >
            {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <span className="text-slate-500">against</span>
          <select
            aria-label="Second metric"
            value={metricB}
            onChange={(e) => setMetricB(e.target.value as typeof metricB)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 outline-none"
          >
            {METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>
        <GlassPanel className="p-6">
          <PanelTitle title="Custom plot" badge="dual axis" />
          <CustomTrend
            daily={data.daily}
            a={METRICS.find((m) => m.key === metricA)!}
            b={METRICS.find((m) => m.key === metricB)!}
          />
        </GlassPanel>
      </div>
    );
  }

  // Views vs Spend (default)
  return (
    <div className="cos-reveal flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total views" value={fmtCompact(totalViews)} foot="period" />
        <StatCard label="Total spend" value={fmtMoney(totalSpend)} foot="period" />
        <StatCard label="Blended CPV" value={fmtCpv(blendedCpv)} foot="cost per view" accentClass="text-emerald-600" />
      </div>
      <GlassPanel className="p-6">
        <PanelTitle title="Daily views vs spend" badge={`${fmtCompact(totalViews)} views · ${fmtMoney(totalSpend)}`} />
        <ViewsSpendTrend daily={data.daily} />
      </GlassPanel>
    </div>
  );
}
