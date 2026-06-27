import { BarChart3, LayoutGrid, TrendingUp, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "command" | "lab" | "hook" | "trend" | "vault";

export const TABS: { id: TabId; label: string; icon: typeof Zap; clientOnly: boolean; subs: string[] }[] = [
  { id: "command", label: "Command Center", icon: LayoutGrid, clientOnly: false, subs: ["Portfolio", "Account Health", "This Week"] },
  { id: "lab", label: "Creative Testing Lab", icon: Zap, clientOnly: true, subs: ["Leaderboard", "Test Pipeline", "Compare"] },
  { id: "hook", label: "Hook & Retention", icon: BarChart3, clientOnly: true, subs: ["Quartile Funnel", "Retention Curves", "Hook Rate Ranking", "Drop-off Map"] },
  { id: "trend", label: "Trendlines", icon: TrendingUp, clientOnly: true, subs: ["Views vs Spend", "View Rate", "Conversions", "Custom"] },
  { id: "vault", label: "Winning Vault", icon: Trophy, clientOnly: true, subs: ["Winners"] },
];

export const subsFor = (id: TabId): string[] => TABS.find((t) => t.id === id)?.subs ?? [];

interface SidebarProps {
  tab: TabId;
  onTab: (t: TabId) => void;
  /** Whether a client is selected — client-only tabs are disabled otherwise. */
  hasClient: boolean;
  /** Optional subset of tabs to render (e.g. the public share view omits Command Center). */
  tabs?: TabId[];
}

export function CreativeOSSidebar({ tab, onTab, hasClient, tabs }: SidebarProps) {
  const visible = tabs ? TABS.filter((t) => tabs.includes(t.id)) : TABS;
  return (
    <nav className="w-[60px] lg:w-[216px] flex-shrink-0 border-r border-slate-200 bg-white/70 flex flex-col gap-1 p-2.5 overflow-y-auto">
      {visible.map((t) => {
        const disabled = t.clientOnly && !hasClient;
        const active = t.id === tab;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            title={disabled ? "Select a client to view this" : t.label}
            disabled={disabled}
            onClick={() => onTab(t.id)}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
              "justify-center lg:justify-start",
              active ? "bg-indigo-50 text-slate-900" : "text-slate-500 hover:bg-slate-50",
              disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
            )}
          >
            {active && <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded bg-indigo-500" />}
            <Icon className={cn("w-[18px] h-[18px]", active ? "text-indigo-600" : "text-slate-400")} />
            <span className={cn("hidden lg:block text-[13px]", active ? "font-bold" : "font-medium")}>
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
