# CreativeOS — Live Creative Dashboard — Design

**Date:** 2026-06-25
**Status:** Approved design (pending spec review)
**Author:** Edafe + Claude

## 1. Summary

CreativeOS is a new, standalone **live dashboard** in the Ad-Lab Insight Engine that displays
Google Ads **Video and Demand Gen** creative performance for all active clients on the MCC.

Unlike the existing report endpoints (Weekly, Audit, Competitor, YouTube), CreativeOS does **not**
generate AI HTML or insights. It pulls data **live from the Google Ads API on demand** and renders
it client-side in a clean, professionally designed React dashboard.

- **Layout / information architecture:** from `src/assets/CreativeOS.dc.html` (sidebar + topbar +
  tabs + sub-tabs + filter bar).
- **Visual design language:** from `src/assets/youtube-report-template.html` (light glass panels,
  Plus Jakarta Sans + Space Grotesk, indigo brand, YouTube-style creative cards, chart styling).
- **Exclusions:** Competitor Radar, Attribution, Action Plan, Integrations & Settings tabs are NOT
  built. The pink/gradient page header shows **only** when a specific client is selected — never on
  the all-clients portfolio view.

## 2. Goals & non-goals

### Goals
- One-click `/creativeos` route that, on open, auto-pulls account-level rollups for every active
  client and shows a portfolio Command Center.
- Drill into a single client to see creative-level performance, hook & retention, trendlines, and
  the winning vault — pulled live for that client.
- Data refreshes on: **open**, **manual Refresh**, and **date-range change** (including expanding
  beyond the default last-14-days window).
- Pure data display. WIN/TEST/RETIRE status comes from **Google Ads labels**, not AI or computed
  heuristics.

### Non-goals (v1)
- No AI-generated narrative, insights, or recommendations.
- No Competitor Radar, Attribution, Action Plan, or Settings tabs.
- No background auto-polling (live API calls are expensive).
- No persistence of dashboard state to Supabase (the app's Supabase only holds `report_jobs`).

## 3. Decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Data path | **Fully live** from Google Ads API. If too slow, add a dedicated cache table later (design must not require frontend changes to add it). |
| Channel scope | **Video + Demand Gen** campaigns. |
| Sections | Command Center, Creative Testing Lab, Hook & Retention, Trendlines, Winning Vault. |
| Client universe + entry | **Live MCC list** of active accounts + new `/creativeos` route, reached from a card on the Index dashboard. |
| Charts | **recharts** (`^2.15.4`, already a dependency). |
| Win classification | **Google Ads labels** (`win` / `test` / `loss`), mapped to WIN / TEST / RETIRE. Unlabeled → "—". |
| Initial load | **Auto-pull** portfolio rollups on open. |

## 4. Architecture

```
┌─────────────────────────────┐        GET /webhook/creativeos        ┌────────────────────────┐
│  React app (Vite SPA)       │  ?scope=portfolio | client            │  n8n: "CreativeOS —    │
│  /creativeos route          │  &customerId &start &end              │  Live Data" workflow   │
│                             │  Authorization: Bearer <WEBHOOK_KEY>  │  (built into 5B9bHIEO…)│
│  - TanStack Query           │ ───────────────────────────────────► │                        │
│  - recharts                 │ ◄─────────────── JSON ─────────────── │  Google Ads OAuth2     │
│  - light/glass UI           │                                       │  cred LmG0IOX0B4Va0yNI │
└─────────────────────────────┘                                       └────────────────────────┘
```

### 4.1 n8n workflow ("CreativeOS — Live Data")

Built into the existing empty workflow `5B9bHIEOeOEcYeG1` ("My workflow 10"), renamed.

- **Trigger:** Webhook (GET), friendly path (e.g. `creativeos`), **Header Auth** credential so the
  frontend's `Authorization: Bearer <VITE_WEBHOOK_KEY>` is validated (matches existing report
  endpoints' auth pattern). Full production URL: `https://ad-lab.app.n8n.cloud/webhook/creativeos`
  (same base host as the existing report webhooks in `src/lib/api.ts`).
- **Router (`scope` param):**
  - `scope=portfolio`:
    1. List active accounts under the MCC (customers with Video/Demand-Gen spend in `[start,end]`).
    2. For each, run a single account-rollup GAQL query (spend, impressions, views, view rate,
       avg CPV, conversions, conversions value; counts of win/test/loss-labeled campaigns).
       This is an N-account fan-out; run it with bounded concurrency (e.g. n8n loop /
       Split-in-Batches) so a large MCC doesn't serialize into minutes. Expected account count
       and observed latency here are the signal for whether the §4.1 cache escape hatch is needed.
    3. Aggregate → JSON array of client rollups + portfolio totals.
  - `scope=client` (requires `customerId`):
    1. Creative-level GAQL for that account over `[start,end]`: per video/ad — impressions,
       video_views, video_view_rate, average_cpv, cost, conversions, conversions_value,
       video_quartile_p25/p50/p75/p100 rates, YouTube video id, campaign label, format, duration.
    2. Daily series (segments.date) for trendlines.
    3. → JSON: `creatives[]`, `daily[]`, `account` meta, `benchmarks`.
- **Params:** `scope` (required), `customerId` (required for client), `start`, `end`
  (ISO `YYYY-MM-DD`; default = today−14 .. today).
- **Response:** `Respond to Webhook` node with JSON. HTTP errors and per-account failures are
  reported in the payload (see §7), never crash the whole response.
- **Cache escape hatch:** the GAQL pulls are isolated in their own nodes; if live latency is
  unacceptable, a Supabase/Postgres read/write (`creativeos_snapshots`) can be inserted in front of
  the GAQL nodes with no change to the response contract or the frontend.

### 4.2 Google Ads query notes

- **Status labels:** read campaign labels; map `win`/`test`/`loss` (case-insensitive) →
  WIN/TEST/RETIRE. A creative inherits its (single-video test) campaign's label.
  **Assumption to verify in implementation:** labels are applied at campaign level and spelled
  win/test/loss. If they live on ads or differ, adjust the GAQL resource and mapping accordingly.
- **Demand Gen risk:** Demand Gen campaigns may not expose the full video-quartile metric set. Where
  quartile data is absent, render all other metrics and **gracefully hide the retention curve** for
  that creative rather than error.

### 4.3 Frontend (`/creativeos`)

- New protected route in `src/App.tsx` (`<Route path="/creativeos" …>` inside `ProtectedRoute`).
- New entry card "06 / CreativeOS" on the Index dashboard report-type grid → navigates to the route.
- New API helpers in `src/lib/api.ts` (or a new `src/lib/creativeos.ts`):
  `fetchPortfolio({start,end})` and `fetchClient({customerId,start,end})`, both using the
  `Authorization: Bearer <WEBHOOK_KEY>` header.
- Data fetching via **TanStack Query**: `["creativeos","portfolio",range]` on mount;
  `["creativeos","client",customerId,range]` on client select. Refresh button = `refetch`.
  Date-range change = new query key → refetch.
- **Component breakdown** (each focused, independently understandable):
  - `CreativeOSPage` — route shell, owns selected client + date range state.
  - `CreativeOSTopbar` — logo, account switcher, date-range picker, Live/Refresh control.
  - `CreativeOSSidebar` — 5 tabs.
  - `CreativeOSFilterBar` — account/format/status/search chips.
  - `PageHeader` — plain on portfolio; **pink/gradient** when a client is selected.
  - Tab views: `CommandCenter`, `CreativeLab`, `HookRetention`, `Trendlines`, `WinningVault`.
  - Shared atoms: `StatCard`, `GlassPanel`, `CreativeCard`, `StatusBadge`, chart wrappers
    (`RetentionCurve`, `QuartileFunnel`, `TrendChart`, `HookRanking`) built on recharts.
- **Styling:** Plus Jakarta Sans + Space Grotesk, indigo brand, light glass panels — reusing the
  youtube-report-template's visual tokens. recharts themed to match.

## 5. Sections / tabs

| Tab | Data scope | Content |
|---|---|---|
| **Command Center** | portfolio | Stat band (clients live, portfolio spend, blended win-rate); per-client cards (spend, view rate, win-rate, status counts). Default landing. No pink header. |
| **Creative Testing Lab** | client | Top-3 hero creative cards + sortable creative leaderboard table (impr, views, VVR, hook, completion, CPV, conv, status). |
| **Hook & Retention** | client | Quartile funnel, retention curves (top creatives), hook-rate ranking, drop-off heatmap. Hidden/partial where Demand Gen lacks quartiles. |
| **Trendlines** | client | Daily views vs spend, daily view rate, daily conversions over the window. |
| **Winning Vault** | portfolio + client | All WIN-labeled creatives across active clients (and per-client), sortable, with YouTube thumbnails/links. |

## 6. Data shapes (response contracts)

```jsonc
// scope=portfolio
{
  "window": { "start": "2026-06-11", "end": "2026-06-25" },
  "totals": { "spend": 0, "views": 0, "conversions": 0, "clientsLive": 0, "winRate": 0 },
  "clients": [
    { "customerId": "711-060-6646", "name": "glowora", "spend": 0, "views": 0,
      "viewRate": 0, "avgCpv": 0, "conversions": 0,
      "status": { "win": 0, "test": 0, "loss": 0 } }
  ],
  "errors": [ { "customerId": "…", "message": "…" } ]   // partial-failure list, may be empty
}

// scope=client
{
  "window": { "start": "…", "end": "…" },
  "account": { "customerId": "…", "name": "…" },
  "benchmarks": { "viewRate": 0, "hook": 0, "cpv": 0 },   // account averages, for shading
  "creatives": [
    { "videoId": "abc123", "title": "…", "format": "In-stream", "durationSec": 15,
      "impressions": 0, "views": 0, "viewRate": 0, "avgCpv": 0, "cost": 0,
      "conversions": 0, "conversionsValue": 0,
      "quartiles": { "p25": 0, "p50": 0, "p75": 0, "p100": 0 } | null,
      "status": "win" | "test" | "loss" | null }
  ],
  "daily": [ { "date": "2026-06-11", "views": 0, "spend": 0, "viewRate": 0, "conversions": 0 } ]
}
```

## 7. Error handling & loading states

- **Loading:** skeleton stat cards / table rows; a "Pulling live from Google Ads…" indicator with
  elapsed time, since live pulls can take seconds.
- **Partial failure (portfolio):** an account that errors is reported in `errors[]` and shown as a
  non-blocking notice; the rest of the portfolio still renders.
- **Full failure:** toast + a Retry action; the route does not white-screen.
- **Empty:** "No active video/Demand-Gen clients in this window" empty state.
- **Auth:** missing/invalid `WEBHOOK_KEY` → clear error, not a silent blank.

## 8. Testing

- **n8n:** validate the workflow (`validate_workflow`) and execute against a known MCC + one client
  for a fixed window; assert JSON matches the §6 contracts and that win/test/loss labels map.
- **Frontend:** component tests (Vitest, already configured) for status mapping, date-range default
  (last 14 days), and graceful handling of `quartiles: null`. Manual run via the dev server to
  confirm portfolio auto-load, client drill, refresh, and date-range refetch.

## 9. Open questions / assumptions — RESOLVED via discovery (2026-06-25)

**Confirmed from existing production Google Ads workflows:**
- **MCC id:** `4056871092`. Dev-token `1zbn0cEIYjIq72aVw6r8PA`, `login-customer-id: 4056871092` headers on every call. OAuth2 cred `LmG0IOX0B4Va0yNI`. Calls via HTTP Request node → `googleads.googleapis.com/v21/customers/{id}/googleAds:search`.
- **Active accounts:** `FROM customer_client WHERE customer_client.status='ENABLED' AND customer_client.manager=false`.
- **Video/creative:** resource `video`, TrueView-named metrics, `video.id` = YouTube id.
- **Labels:** campaign-level via `campaign_label`. Matched case-insensitively to win/test/loss.
  ⚠️ The win/test/loss labels could not be independently verified (the workflows that use them are not MCP-readable); proceeding on the user's explicit statement that campaigns are labeled win/test/loss, with tolerant matching. **Verify exact spelling against the live account when convenient.**
- **Demand Gen quartiles:** net-new/unproven; degrade gracefully (`quartiles: null`).

### Remaining (low-risk) assumptions

1. **Label location & spelling** — confirm win/test/loss labels are campaign-level and exact
   spelling against the live MCC before finalizing GAQL. **This is the feature's core value and
   the GAQL resource choice (campaign vs ad) depends on it — make it the first implementation
   task**, not a parallel assumption.
2. **Active-client definition** — "active" = had Video/Demand-Gen spend (or impressions) in the
   selected window. Confirm this is the intended definition.
3. **Demand Gen quartiles** — confirm which metrics Demand Gen exposes; adjust graceful-hide logic.
4. **MCC account id** — confirm the manager (MCC) customer id to enumerate accounts under.
```
