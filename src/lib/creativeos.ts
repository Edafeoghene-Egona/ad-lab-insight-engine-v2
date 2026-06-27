import type {
  DateRange,
  CreativeStatus,
  PortfolioResponse,
  ClientResponse,
} from "./creativeos-types";

// ── Pure helpers ──────────────────────────────────────────────────────────

// Shared, framework-free date logic lives in ./date-range (also used server-side).
export { defaultRange } from "./date-range";

/** Map a raw Google Ads label name to a CreativeStatus (case-insensitive). */
export function normalizeStatus(raw?: string | null): CreativeStatus {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "win" || v === "test" || v === "loss" ? v : null;
}

/** Display label for a status. `loss` reads as RETIRE; null reads as an em dash. */
export function statusLabel(s: CreativeStatus): string {
  return s === "loss" ? "RETIRE" : s ? s.toUpperCase() : "—";
}

/** Compact number: 1.4k, 457k, 1.2M. */
export function fmtCompact(n: number): string {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return Math.round(n / 1_000) + "k";
  return String(Math.round(n));
}

/** Whole-dollar money with thousands separators: $10,975. */
export function fmtMoney(n: number): string {
  if (!isFinite(n)) return "—";
  return "$" + Math.round(n).toLocaleString("en-US");
}

/** CPV-style money to 3 decimals: $0.024. */
export function fmtCpv(n: number): string {
  if (!isFinite(n)) return "—";
  return "$" + n.toFixed(3);
}

/** Rate (0..1) → percent string. `frac=true` when input is a 0..1 fraction. */
export function fmtPct(n: number, frac = false): string {
  if (!isFinite(n)) return "—";
  return (frac ? n * 100 : n).toFixed(1) + "%";
}

/**
 * Normalize a rate to a 0..100 number, tolerant of either convention:
 * Google Ads emits view/quartile rates as 0..1 fractions, but some
 * aggregations may already be percentages. Values ≤ 1 are treated as
 * fractions and scaled; values > 1 are assumed already-percent.
 */
export function ratePct(v: number): number {
  if (!isFinite(v)) return 0;
  return v <= 1 ? v * 100 : v;
}

// ── API fetchers ──────────────────────────────────────────────────────────

const CREATIVEOS_URL = "https://ad-lab.app.n8n.cloud/webhook/creativeos";
const WEBHOOK_KEY = import.meta.env.VITE_WEBHOOK_KEY || "";
const authHeaders = { Authorization: `Bearer ${WEBHOOK_KEY}` };

export async function fetchPortfolio(range: DateRange): Promise<PortfolioResponse> {
  const u = new URL(CREATIVEOS_URL);
  u.searchParams.set("scope", "portfolio");
  u.searchParams.set("start", range.start);
  u.searchParams.set("end", range.end);
  const res = await fetch(u, { headers: authHeaders });
  if (!res.ok) throw new Error(`CreativeOS portfolio failed: ${res.status}`);
  return res.json();
}

export async function fetchClient(
  customerId: string,
  range: DateRange,
): Promise<ClientResponse> {
  const u = new URL(CREATIVEOS_URL);
  u.searchParams.set("scope", "client");
  u.searchParams.set("customerId", customerId);
  u.searchParams.set("start", range.start);
  u.searchParams.set("end", range.end);
  const res = await fetch(u, { headers: authHeaders });
  if (!res.ok) throw new Error(`CreativeOS client failed: ${res.status}`);
  return res.json();
}
