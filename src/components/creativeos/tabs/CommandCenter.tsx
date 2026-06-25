import { DollarSign, Play, Trophy, Users, AlertTriangle, Trash2 } from "lucide-react";
import { GlassPanel } from "../GlassPanel";
import { StatCard } from "../StatCard";
import { ViewsSpendTrend } from "../charts/TrendChart";
import { fmtCompact, fmtMoney, ratePct } from "@/lib/creativeos";
import type { ClientRollup, DailyPoint, PortfolioResponse } from "@/lib/creativeos-types";
import { cn } from "@/lib/utils";

const winPctOf = (s: ClientRollup["status"]) => {
  const total = s.win + s.test + s.loss;
  return total ? Math.round((s.win / total) * 100) : 0;
};

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
  const winPct = winPctOf(status);
  const sparkPoints = (client.daily ?? []).map((d) => d.views);
  return (
    <button onClick={onSelect} className="cos-stat-card cos-glass rounded-2xl p-5 text-left flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <div className="cos-display w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
          {(client.name?.[0] ?? "?").toUpperCase()}
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

function ErrorsNotice({ errors }: { errors: PortfolioResponse["errors"] }) {
  if (!errors.length) return null;
  return (
    <GlassPanel className="p-4 border-l-4 border-l-amber-400 flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
      <div className="text-xs text-slate-600">
        <span className="font-semibold text-slate-700">{errors.length} account(s) couldn’t be loaded</span> and were
        skipped: {errors.map((e) => e.customerId).join(", ")}.
      </div>
    </GlassPanel>
  );
}

// ── Account Health matrix ───────────────────────────────────────────────────
function AccountHealth({ data, onSelectClient }: { data: PortfolioResponse; onSelectClient: (id: string) => void }) {
  const rows = [...data.clients].sort((a, b) => b.spend - a.spend);
  const roasOf = (c: ClientRollup) => (c.conversionsValue != null && c.spend > 0 ? c.conversionsValue / c.spend : null);

  const cell = (val: string, tone: "good" | "warn" | "bad" | "none") => {
    const m = {
      good: "bg-emerald-50 text-emerald-700",
      warn: "bg-amber-50 text-amber-700",
      bad: "bg-rose-50 text-rose-700",
      none: "text-slate-500",
    }[tone];
    return <div className={cn("text-center rounded-md py-1.5 text-[13px] font-bold tabular-nums", m)}>{val}</div>;
  };

  return (
    <div className="cos-reveal flex flex-col gap-4">
      <p className="text-sm text-slate-500">
        Red cells flag accounts drifting below benchmark. <span className="text-slate-700 font-semibold">↳ ROAS is Google Ads last-click conversion value ÷ spend.</span>
      </p>
      <GlassPanel className="p-5 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid items-center gap-3 pb-2.5 border-b border-slate-200 mb-1" style={{ gridTemplateColumns: "200px repeat(5,1fr)" }}>
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Client</div>
            {["ROAS", "View rate", "Win rate", "Conversions", "Spend"].map((h) => (
              <div key={h} className="text-[10px] uppercase tracking-wider text-slate-400 font-bold text-center">{h}</div>
            ))}
          </div>
          {rows.map((c) => {
            const roas = roasOf(c);
            const vr = ratePct(c.viewRate);
            const wr = winPctOf(c.status);
            return (
              <div key={c.customerId} className="grid items-center gap-3 py-1.5" style={{ gridTemplateColumns: "200px repeat(5,1fr)" }}>
                <button
                  type="button"
                  onClick={() => onSelectClient(c.customerId)}
                  className="flex items-center gap-2 text-left min-w-0 hover:text-indigo-600"
                >
                  <span className="cos-display w-6 h-6 rounded bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                    {(c.name?.[0] ?? "?").toUpperCase()}
                  </span>
                  <span className="text-[12.5px] font-semibold truncate">{c.name}</span>
                </button>
                {cell(roas == null ? "—" : roas.toFixed(1) + "×", roas == null ? "none" : roas >= 2 ? "good" : roas >= 1 ? "warn" : "bad")}
                {cell(vr.toFixed(1) + "%", vr >= 25 ? "good" : vr >= 15 ? "warn" : "bad")}
                {cell(wr + "%", wr >= 30 ? "good" : wr >= 15 ? "warn" : "bad")}
                {cell(Math.round(c.conversions).toLocaleString(), "none")}
                {cell(fmtMoney(c.spend), "none")}
              </div>
            );
          })}
        </div>
      </GlassPanel>
    </div>
  );
}

// ── This Week summary ─────────────────────────────────────────────────────────
function ThisWeek({ data }: { data: PortfolioResponse }) {
  const tested = data.clients.reduce((s, c) => s + c.status.win + c.status.test + c.status.loss, 0);
  const winners = data.clients.reduce((s, c) => s + c.status.win, 0);
  const retirements = data.clients.reduce((s, c) => s + c.status.loss, 0);

  // Aggregate per-client daily into a single portfolio daily series.
  const byDate: Record<string, DailyPoint> = {};
  for (const c of data.clients) {
    for (const d of c.daily ?? []) {
      const e = (byDate[d.date] ||= { date: d.date, views: 0, spend: 0, viewRate: 0, conversions: 0 });
      e.views += d.views;
      e.spend += d.spend;
      e.conversions += d.conversions;
    }
  }
  const daily = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="cos-reveal flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Creatives tested" value={tested.toLocaleString()} foot={`across ${data.totals.clientsLive} clients`} />
        <StatCard label="Winners" value={String(winners)} foot="reached WIN" accentClass="text-emerald-600" icon={Trophy} />
        <StatCard label="Retirements" value={String(retirements)} foot="hit kill threshold" accentClass="text-rose-600" icon={Trash2} />
        <StatCard label="Portfolio win rate" value={ratePct(data.totals.winRate).toFixed(0) + "%"} foot="of classified creatives" accentClass="text-indigo-600" />
      </div>
      {daily.length > 1 && (
        <GlassPanel className="p-6">
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4 flex justify-between items-center">
            Portfolio views vs spend
            <span className="text-[10px] bg-slate-100 border border-slate-200 px-2 py-1 rounded text-slate-500">
              {fmtCompact(data.totals.views)} views · {fmtMoney(data.totals.spend)}
            </span>
          </h3>
          <ViewsSpendTrend daily={daily} />
        </GlassPanel>
      )}
    </div>
  );
}

// ── Portfolio (default) ───────────────────────────────────────────────────────
function Portfolio({ data, onSelectClient }: { data: PortfolioResponse; onSelectClient: (id: string) => void }) {
  const { totals, clients, errors } = data;
  const sorted = [...clients].sort((a, b) => b.spend - a.spend);
  return (
    <div className="cos-reveal flex flex-col gap-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Clients live" value={String(totals.clientsLive)} foot="active accounts" icon={Users} />
        <StatCard label="Portfolio spend" value={fmtMoney(totals.spend)} foot="selected window" icon={DollarSign} />
        <StatCard label="Total views" value={fmtCompact(totals.views)} foot="video + demand gen" icon={Play} />
        <StatCard label="Win rate" value={ratePct(totals.winRate).toFixed(0) + "%"} foot="classified creatives" icon={Trophy} accentClass="text-indigo-600" />
      </div>
      <ErrorsNotice errors={errors} />
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

export function CommandCenter({
  data,
  sub,
  onSelectClient,
}: {
  data: PortfolioResponse;
  sub: string;
  onSelectClient: (id: string) => void;
}) {
  if (sub === "Account Health") return <AccountHealth data={data} onSelectClient={onSelectClient} />;
  if (sub === "This Week") return <ThisWeek data={data} />;
  return <Portfolio data={data} onSelectClient={onSelectClient} />;
}
