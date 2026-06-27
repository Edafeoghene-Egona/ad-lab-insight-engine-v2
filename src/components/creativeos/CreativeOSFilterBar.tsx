import { Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CreativeStatus } from "@/lib/creativeos-types";

export type StatusFilter = "all" | "win" | "test" | "loss";

const OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "win", label: "Win" },
  { id: "test", label: "Test" },
  { id: "loss", label: "Retire" },
];

interface FilterBarProps {
  statusFilter: StatusFilter;
  onStatusFilter: (s: StatusFilter) => void;
  search: string;
  onSearch: (s: string) => void;
}

/** Status segmented control + creative search. Applies to client-scope tables. */
export function CreativeOSFilterBar({ statusFilter, onStatusFilter, search, onSearch }: FilterBarProps) {
  return (
    <div className="flex-shrink-0 border-b border-slate-200 bg-white/60 px-6 lg:px-8 py-2.5 flex items-center gap-3">
      <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
      <div className="inline-flex gap-0.5 bg-slate-100 border border-slate-200 rounded-lg p-0.5">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            onClick={() => onStatusFilter(o.id)}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
              statusFilter === o.id ? "bg-indigo-600 text-white" : "text-slate-500 hover:text-slate-700",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex-1" />
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search creatives"
          className="w-48 pl-8 pr-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-300"
        />
      </div>
    </div>
  );
}

/** Predicate helper: does a creative pass the current status filter? */
export function matchesStatus(status: CreativeStatus, filter: StatusFilter): boolean {
  return filter === "all" || status === filter;
}
