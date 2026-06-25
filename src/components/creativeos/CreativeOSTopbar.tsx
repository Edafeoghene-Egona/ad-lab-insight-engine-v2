import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronDown, RefreshCw, Search } from "lucide-react";
import type { ClientRollup, DateRange } from "@/lib/creativeos-types";
import { cn } from "@/lib/utils";

const PRESETS: { label: string; days: number | "mtd" }[] = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 28 days", days: 28 },
  { label: "Month to date", days: "mtd" },
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
function presetRange(days: number | "mtd"): DateRange {
  const today = new Date();
  if (days === "mtd") return { start: iso(new Date(today.getFullYear(), today.getMonth(), 1)), end: iso(today) };
  return { start: iso(new Date(today.getTime() - days * 864e5)), end: iso(today) };
}

function useDismiss<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouse);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouse);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  return ref;
}

const initial = (s?: string) => (s?.[0] ?? "?").toUpperCase();

interface TopbarProps {
  clients: ClientRollup[];
  selectedId: string | null;
  onSelectClient: (id: string | null) => void;
  range: DateRange;
  onRange: (r: DateRange) => void;
  rangeLabel: string;
  onRefresh: () => void;
  isFetching: boolean;
}

export function CreativeOSTopbar({
  clients,
  selectedId,
  onSelectClient,
  range,
  onRange,
  rangeLabel,
  onRefresh,
  isFetching,
}: TopbarProps) {
  const [acctOpen, setAcctOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const acctRef = useDismiss<HTMLDivElement>(() => setAcctOpen(false));
  const dateRef = useDismiss<HTMLDivElement>(() => setDateOpen(false));

  const selected = clients.find((c) => c.customerId === selectedId);
  const filtered = clients.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="h-14 flex-shrink-0 border-b border-slate-200 bg-white/80 flex items-center gap-3 px-4 relative z-30">
      <div className="flex items-center gap-2.5">
        <div className="cos-display w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
          A
        </div>
        <div className="leading-none hidden sm:block">
          <div className="cos-display font-bold text-[15px] text-slate-900">Ad-Lab</div>
          <div className="text-[8.5px] tracking-[0.12em] text-slate-400 font-semibold">CREATIVEOS</div>
        </div>
      </div>
      <div className="w-px h-6 bg-slate-200" />

      {/* Account switcher */}
      <div className="relative" ref={acctRef}>
        <button
          aria-haspopup="menu"
          aria-expanded={acctOpen ? "true" : "false"}
          onClick={() => {
            setAcctOpen((o) => !o);
            setDateOpen(false);
          }}
          className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 hover:border-slate-300"
        >
          <div className="cos-display w-5 h-5 rounded bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
            {initial(selected?.name ?? "A")}
          </div>
          <div className="text-left leading-tight">
            <div className="text-xs font-bold text-slate-800">{selected ? selected.name : "All clients"}</div>
            <div className="text-[9.5px] text-slate-400">{selected ? selected.customerId : "portfolio"}</div>
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
        {acctOpen && (
          <div className="absolute top-11 left-0 w-64 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-40">
            <div className="relative mb-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clients"
                className="w-full pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-300"
              />
            </div>
            <button
              onClick={() => {
                onSelectClient(null);
                setAcctOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-2 rounded-lg text-left hover:bg-slate-50",
                !selectedId && "bg-slate-50",
              )}
            >
              <span className="text-xs font-semibold text-slate-700">← All clients (portfolio)</span>
            </button>
            <div className="max-h-64 overflow-y-auto">
              {filtered.map((c) => (
                <button
                  key={c.customerId}
                  onClick={() => {
                    onSelectClient(c.customerId);
                    setAcctOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-2 py-2 rounded-lg text-left hover:bg-slate-50",
                    c.customerId === selectedId && "bg-slate-50",
                  )}
                >
                  <div className="cos-display w-5 h-5 rounded bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
                    {c.name[0].toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-slate-700 flex-1 truncate">{c.name}</span>
                </button>
              ))}
              {filtered.length === 0 && <p className="text-xs text-slate-400 px-2 py-3">No clients match.</p>}
            </div>
          </div>
        )}
      </div>

      {/* Date range */}
      <div className="relative" ref={dateRef}>
        <button
          aria-haspopup="menu"
          aria-expanded={dateOpen ? "true" : "false"}
          onClick={() => {
            setDateOpen((o) => !o);
            setAcctOpen(false);
          }}
          className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
        >
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          {rangeLabel}
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
        {dateOpen && (
          <div className="absolute top-11 left-0 w-56 bg-white border border-slate-200 rounded-xl shadow-xl p-1.5 z-40">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => {
                  onRange(presetRange(p.days));
                  setDateOpen(false);
                }}
                className={cn(
                  "block w-full text-left px-2.5 py-2 rounded-lg text-xs hover:bg-slate-50",
                  p.label === rangeLabel ? "font-bold text-slate-900 bg-slate-50" : "text-slate-600",
                )}
              >
                {p.label}
              </button>
            ))}
            <div className="border-t border-slate-100 mt-1 pt-2 px-1.5 pb-1 grid grid-cols-2 gap-2">
              <label className="text-[10px] text-slate-400 col-span-2 uppercase tracking-wider font-bold">
                Custom range
              </label>
              <input
                type="date"
                aria-label="Start date"
                value={range.start}
                max={range.end}
                onChange={(e) => {
                  const start = e.target.value;
                  if (start && start <= range.end) onRange({ ...range, start });
                }}
                className="border border-slate-200 rounded-md px-1.5 py-1 text-[11px] outline-none focus:border-indigo-300"
              />
              <input
                type="date"
                aria-label="End date"
                value={range.end}
                min={range.start}
                onChange={(e) => {
                  const end = e.target.value;
                  if (end && end >= range.start) onRange({ ...range, end });
                }}
                className="border border-slate-200 rounded-md px-1.5 py-1 text-[11px] outline-none focus:border-indigo-300"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <button
        onClick={onRefresh}
        disabled={isFetching}
        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg px-3.5 py-2 text-xs font-bold transition-colors"
      >
        <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
        {isFetching ? "Pulling…" : "Refresh"}
      </button>
    </div>
  );
}

export { defaultRange };
