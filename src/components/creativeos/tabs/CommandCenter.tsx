import { AlertTriangle, DollarSign, Play, Trophy, Users } from "lucide-react";
import { GlassPanel } from "../GlassPanel";
import { StatCard } from "../StatCard";
import { fmtCompact, fmtMoney, ratePct } from "@/lib/creativeos";
import type { ClientRollup, PortfolioResponse } from "@/lib/creativeos-types";

/** Minimal inline sparkline of daily views — no chart lib needed for a thumbnail trend. */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const w = 96;
  const h = 24;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const d = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - 2 - ((v - min) / range) * (h - 4);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="overflow-visible">
      <path d={d} fill="none" stroke="#6366f1" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClientCard({ client, onSelect }: { client: ClientRollup; onSelect: () => void }) {
  const { status } = client;
  const total = status.win + status.test + status.loss;
  const winPct = total ? Math.round((status.win / total) * 100) : 0;
  const sparkPoints = (client.daily ?? []).map((d) => d.views);
  return (
    <button
      onClick={onSelect}
      className="cos-stat-card cos-glass rounded-2xl p-5 text-left flex flex-col gap-3"
    >
      <div className="flex items-center gap-2.5">
        <div className="cos-display w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
          {client.name[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-slate-900 truncate">{client.name}</div>
          <div className="text-[10.5px] text-slate-400">{client.customerId}</div>
        </div>
        <span
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: winPct >= 40 ? "#10b981" : winPct >= 20 ? "#f59e0b" : "#f43f5e" }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["Spend", fmtMoney(client.spend)],
            ["View rate", ratePct(client.viewRate).toFixed(1) + "%"],
            ["Win rate", winPct + "%"],
          ] as [string, string][]
        ).map(([k, v]) => (
          <div key={k} className="bg-slate-50 rounded-lg px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">{k}</p>
            <p className="cos-display text-base font-bold text-slate-800 mt-0.5 tabular-nums">{v}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="text-emerald-600 font-semibold">{status.win} win</span>
          <span className="text-violet-600 font-semibold">{status.test} test</span>
          <span className="text-rose-600 font-semibold">{status.loss} retire</span>
        </div>
        <Sparkline points={sparkPoints} />
      </div>
    </button>
  );
}

export function CommandCenter({
  data,
  onSelectClient,
}: {
  data: PortfolioResponse;
  onSelectClient: (id: string) => void;
}) {
  const { totals, clients, errors } = data;
  const sorted = [...clients].sort((a, b) => b.spend - a.spend);

  return (
    <div className="cos-reveal flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Clients live" value={String(totals.clientsLive)} foot="active accounts" icon={Users} />
        <StatCard label="Portfolio spend" value={fmtMoney(totals.spend)} foot="selected window" icon={DollarSign} />
        <StatCard label="Total views" value={fmtCompact(totals.views)} foot="video + demand gen" icon={Play} />
        <StatCard
          label="Win rate"
          value={ratePct(totals.winRate).toFixed(0) + "%"}
          foot="labeled creatives"
          icon={Trophy}
          accentClass="text-indigo-600"
        />
      </div>

      {errors.length > 0 && (
        <GlassPanel className="p-4 border-l-4 border-l-amber-400 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-slate-600">
            <span className="font-semibold text-slate-700">{errors.length} account(s) couldn’t be loaded</span> and were
            skipped: {errors.map((e) => e.customerId).join(", ")}. The rest of the portfolio is shown.
          </div>
        </GlassPanel>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-px w-8 bg-indigo-500" />
          <h2 className="cos-display text-xl font-semibold text-slate-900">Clients</h2>
        </div>
        <span className="text-[11px] text-slate-400">Sorted by spend · click a client to drill in</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((c) => (
          <ClientCard key={c.customerId} client={c} onSelect={() => onSelectClient(c.customerId)} />
        ))}
      </div>
    </div>
  );
}
