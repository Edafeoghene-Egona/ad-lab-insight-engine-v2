// Response contract types for the CreativeOS live dashboard.
// These mirror the JSON returned by the n8n "CreativeOS — Live Data" workflow
// (webhook /creativeos, scopes `portfolio` and `client`).

export type CreativeStatus = "win" | "test" | "loss" | null;

export interface DateRange {
  start: string;
  end: string;
}

export interface ClientRollup {
  customerId: string;
  name: string;
  spend: number;
  views: number;
  viewRate: number;
  avgCpv: number;
  conversions: number;
  /** Google Ads conversion value (for ROAS). May be absent on older payloads. */
  conversionsValue?: number;
  status: { win: number; test: number; loss: number };
  /** Per-client daily series, returned by the portfolio loop. May be absent on older payloads. */
  daily?: DailyPoint[];
}

export interface PortfolioResponse {
  window: DateRange;
  totals: {
    spend: number;
    views: number;
    conversions: number;
    clientsLive: number;
    winRate: number;
  };
  clients: ClientRollup[];
  errors: { customerId: string; message: string }[];
}

export interface Creative {
  videoId: string | null;
  title: string;
  format: string;
  durationSec: number | null;
  impressions: number;
  views: number;
  viewRate: number;
  avgCpv: number;
  cost: number;
  conversions: number;
  conversionsValue: number;
  quartiles: { p25: number; p50: number; p75: number; p100: number } | null;
  status: CreativeStatus;
}

export interface DailyPoint {
  date: string;
  views: number;
  spend: number;
  viewRate: number;
  conversions: number;
}

export interface ClientResponse {
  window: DateRange;
  account: { customerId: string; name: string };
  benchmarks: { viewRate: number; hook: number; cpv: number };
  creatives: Creative[];
  daily: DailyPoint[];
}
