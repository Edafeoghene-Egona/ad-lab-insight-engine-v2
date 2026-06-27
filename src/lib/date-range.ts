import type { DateRange } from "./creativeos-types";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Last-14-days window (inclusive of `today`), as ISO YYYY-MM-DD strings. */
export function defaultRange(today = new Date()): DateRange {
  return { start: iso(new Date(today.getTime() - 14 * 864e5)), end: iso(today) };
}

/** True when `v` is a strict ISO YYYY-MM-DD date string. */
export function isIsoDate(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}
