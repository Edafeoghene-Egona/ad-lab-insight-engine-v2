import type {
  DateRange,
  CreativeStatus,
  PortfolioResponse,
  ClientResponse,
} from "./creativeos-types";

// ── Pure helpers ──────────────────────────────────────────────────────────

/** Last-14-days window (inclusive of today), as ISO YYYY-MM-DD strings. */
export function defaultRange(today = new Date()): DateRange {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { start: iso(new Date(today.getTime() - 14 * 864e5)), end: iso(today) };
}

/** Map a raw Google Ads label name to a CreativeStatus (case-insensitive). */
export function normalizeStatus(raw?: string | null): CreativeStatus {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "win" || v === "test" || v === "loss" ? v : null;
}

/** Display label for a status. `loss` reads as RETIRE; null reads as an em dash. */
export function statusLabel(s: CreativeStatus): string {
  return s === "loss" ? "RETIRE" : s ? s.toUpperCase() : "—";
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
