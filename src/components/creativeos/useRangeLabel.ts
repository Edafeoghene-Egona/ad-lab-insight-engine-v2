import { useMemo } from "react";
import type { DateRange } from "@/lib/creativeos-types";

const dayMs = 864e5;

/** Human label for a date range: matches a known preset or falls back to the explicit dates. */
export function useMemoizedRangeLabel(range: DateRange): string {
  return useMemo(() => {
    const start = new Date(range.start + "T00:00:00");
    const end = new Date(range.end + "T00:00:00");
    const today = new Date();
    const isToday = end.toDateString() === today.toDateString();
    const spanDays = Math.round((end.getTime() - start.getTime()) / dayMs);

    if (isToday) {
      if (spanDays === 7) return "Last 7 days";
      if (spanDays === 14) return "Last 14 days";
      if (spanDays === 28) return "Last 28 days";
      const mtdStart = new Date(today.getFullYear(), today.getMonth(), 1);
      if (start.toDateString() === mtdStart.toDateString()) return "Month to date";
    }
    const f = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric" });
    return `${f(start)} – ${f(end)}`;
  }, [range.start, range.end]);
}
