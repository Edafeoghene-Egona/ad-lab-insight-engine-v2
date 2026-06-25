import { GlassPanel } from "./GlassPanel";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  foot?: string;
  /** Signed delta; renders a coloured up/down chip when provided. */
  delta?: number;
  deltaSuffix?: string;
  icon?: LucideIcon;
  /** Tailwind text-color class for the value (e.g. "text-indigo-600"). */
  accentClass?: string;
}

export function StatCard({ label, value, foot, delta, deltaSuffix = "", icon: Icon, accentClass }: StatCardProps) {
  const up = (delta ?? 0) >= 0;
  return (
    <GlassPanel className="cos-stat-card p-5 flex flex-col gap-2">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
        {label}
        {Icon && <Icon className="w-3.5 h-3.5 opacity-40" />}
      </p>
      <p className={cn("cos-display text-2xl font-bold tabular-nums", accentClass ?? "text-slate-900")}>{value}</p>
      <div className="flex items-center gap-2">
        {delta != null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-bold",
              up ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {up ? "+" : ""}
            {delta}
            {deltaSuffix}
          </span>
        )}
        {foot && <span className="text-[10px] text-slate-400 uppercase tracking-wider">{foot}</span>}
      </div>
    </GlassPanel>
  );
}
