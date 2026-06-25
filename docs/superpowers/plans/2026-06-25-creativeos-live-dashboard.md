# CreativeOS Live Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CreativeOS — a live `/creativeos` dashboard that pulls Google Ads Video + Demand Gen creative data on demand (no AI/HTML generation) and renders it for all active MCC clients, with per-client drill-down.

**Architecture:** A new n8n webhook workflow ("CreativeOS — Live Data") serves JSON by `scope` (`portfolio` = all active clients' account rollups; `client` = one account's creative-level detail). A new React route (`/creativeos`) fetches that JSON via TanStack Query and renders it using the `.dc.html` layout (sidebar + topbar + tabs) in the `youtube-report-template.html` visual language, charts via recharts. WIN/TEST/RETIRE status comes from Google Ads labels.

**Tech Stack:** React 18 + Vite + React Router v6, TanStack Query, recharts, Tailwind, Vitest + Testing Library, n8n (Google Ads OAuth2 cred `LmG0IOX0B4Va0yNI`).

**Spec:** `docs/superpowers/specs/2026-06-25-creativeos-live-dashboard-design.md`

---

## File Structure

**Frontend (create):**
- `src/lib/creativeos-types.ts` — shared TS types for portfolio + client response contracts.
- `src/lib/creativeos.ts` — API helpers (`fetchPortfolio`, `fetchClient`) + pure helpers (`defaultRange`, `normalizeStatus`).
- `src/lib/creativeos.test.ts` — unit tests for pure helpers.
- `src/pages/CreativeOS.tsx` — route shell: owns selected client + date range, renders topbar/sidebar/tab content, wires queries.
- `src/components/creativeos/CreativeOSTopbar.tsx` — logo, account switcher, date-range picker, Live/Refresh.
- `src/components/creativeos/CreativeOSSidebar.tsx` — 5 tabs.
- `src/components/creativeos/PageHeader.tsx` — plain on portfolio; pink/gradient when a client is selected.
- `src/components/creativeos/StatCard.tsx`, `GlassPanel.tsx`, `StatusBadge.tsx`, `CreativeCard.tsx` — shared atoms.
- `src/components/creativeos/charts/` — `RetentionCurve.tsx`, `QuartileFunnel.tsx`, `TrendChart.tsx`, `HookRanking.tsx` (recharts wrappers).
- `src/components/creativeos/tabs/CommandCenter.tsx`, `CreativeLab.tsx`, `HookRetention.tsx`, `Trendlines.tsx`, `WinningVault.tsx`.
- `src/components/creativeos/states.tsx` — `LoadingState`, `ErrorState`, `EmptyState`.

**Frontend (modify):**
- `src/App.tsx` — add protected `/creativeos` route.
- `src/pages/Index.tsx:373-398` — add "06 / CreativeOS" entry card that navigates to `/creativeos`.

**n8n (modify):**
- Workflow `5B9bHIEOeOEcYeG1` ("My workflow 10") → rebuilt & renamed "CreativeOS — Live Data".

---

## Phase 0 — Verify external unknowns (do FIRST)

### Task 0: Confirm Google Ads label taxonomy + MCC id

**No code.** Resolve §9 of the spec before writing GAQL.

- [ ] **Step 1:** Using the n8n Google Ads cred (`LmG0IOX0B4Va0yNI`), run a probe GAQL against one known account to confirm where win/test/loss labels live and their exact spelling:
  ```sql
  SELECT label.name, label.resource_name FROM label
  ```
  and
  ```sql
  SELECT campaign.id, campaign.name, label.name
  FROM campaign_label
  ```
- [ ] **Step 2:** Confirm the **MCC (manager) customer id** used to enumerate child accounts.
- [ ] **Step 3:** Confirm which video-quartile metrics Demand Gen campaigns expose (probe a Demand Gen campaign).
- [ ] **Step 4:** Record findings inline in the spec's §9 (replace each assumption with the confirmed value). Commit:
  ```bash
  git add docs/superpowers/specs/2026-06-25-creativeos-live-dashboard-design.md
  git commit -m "docs: confirm CreativeOS label taxonomy + MCC id"
  ```

> If labels are NOT campaign-level or not spelled win/test/loss, update every GAQL `label`/`status` reference in Phase 1 accordingly before proceeding.

---

## Phase 1 — n8n workflow "CreativeOS — Live Data"

> Follow the n8n-mcp tool order: `get_sdk_reference` → `get_suggested_nodes` → `search_nodes` → `get_node_types` → write code → `validate_node_config` per node → `validate_workflow` → `create_workflow_from_code`. Build into existing workflow `5B9bHIEOeOEcYeG1`; rename to "CreativeOS — Live Data".

### Task 1: Webhook + auth + router

**Nodes:** Webhook (GET, path `creativeos`, Header Auth cred — reuse the report webhook key) → Switch on `{{$json.query.scope}}` → two branches (`portfolio`, `client`).

- [ ] **Step 1:** Read SDK reference and node types for `webhook`, `switch`, `httpRequest`/`googleAds`, `code`, `respondToWebhook`.
- [ ] **Step 2:** Configure Webhook: GET, path `creativeos`, response mode "Using Respond to Webhook node", Header Auth credential. Query params: `scope`, `customerId`, `start`, `end`.
- [ ] **Step 3:** Add a **Code** node "Resolve range" that defaults `start`/`end` to last 14 days when absent:
  ```js
  const q = $input.first().json.query || {};
  const end = q.end || new Date().toISOString().slice(0,10);
  const start = q.start || new Date(Date.now() - 14*864e5).toISOString().slice(0,10);
  return [{ json: { ...q, start, end } }];
  ```
- [ ] **Step 4:** Switch routes `scope === 'portfolio'` vs `scope === 'client'`.
- [ ] **Step 5:** `validate_node_config` on each node.

### Task 2: Portfolio branch

- [ ] **Step 1:** List active child accounts under the MCC (Google Ads node / GAQL on `customer_client` filtered to accounts with Video/Demand-Gen spend in `[start,end]`).
- [ ] **Step 2:** Split-in-Batches (bounded concurrency, e.g. batch size 5) → per-account rollup GAQL:
  ```sql
  SELECT campaign.advertising_channel_type, metrics.cost_micros, metrics.impressions,
         metrics.video_views, metrics.video_view_rate, metrics.average_cpv,
         metrics.conversions, metrics.conversions_value, label.name
  FROM campaign
  WHERE segments.date BETWEEN '{{start}}' AND '{{end}}'
    AND campaign.advertising_channel_type IN ('VIDEO','DEMAND_GEN')
  ```
- [ ] **Step 2a:** Wrap each account call so a failure pushes `{customerId,message}` to an `errors` array instead of aborting (Continue On Fail + collector).
- [ ] **Step 3:** Code node aggregates to the §6 `portfolio` contract: `clients[]` (with win/test/loss counts from `label.name`), `totals`, `errors[]`.
- [ ] **Step 4:** `Respond to Webhook` returns the JSON.

### Task 3: Client branch

- [ ] **Step 1:** Creative-level GAQL for `customerId` over `[start,end]`:
  ```sql
  SELECT ad_group_ad.ad.id, ad_group_ad.ad.name,
         ad_group_ad.ad.video_responsive_ad.videos,  -- YouTube video id source; adjust per ad type
         campaign.advertising_channel_type, label.name,
         metrics.impressions, metrics.video_views, metrics.video_view_rate,
         metrics.average_cpv, metrics.cost_micros, metrics.conversions, metrics.conversions_value,
         metrics.video_quartile_p25_rate, metrics.video_quartile_p50_rate,
         metrics.video_quartile_p75_rate, metrics.video_quartile_p100_rate
  FROM ad_group_ad
  WHERE segments.date BETWEEN '{{start}}' AND '{{end}}'
    AND campaign.advertising_channel_type IN ('VIDEO','DEMAND_GEN')
  ```
- [ ] **Step 2:** Daily series GAQL (segmented by `segments.date`) for trendlines.
- [ ] **Step 3:** Code node maps to §6 `client` contract: `creatives[]` (quartiles → `null` when absent), `daily[]`, `account`, `benchmarks` (account avg viewRate/hook/cpv). Map `label.name` → `status` (`win`/`test`/`loss`/`null`).
- [ ] **Step 4:** `Respond to Webhook` returns JSON.

### Task 4: Validate, save, smoke-test

- [ ] **Step 1:** `validate_workflow` — fix until clean.
- [ ] **Step 2:** `create_workflow_from_code` (update `5B9bHIEOeOEcYeG1`, name "CreativeOS — Live Data", description noting the contract).
- [ ] **Step 3:** `execute_workflow` for `scope=portfolio` and for `scope=client&customerId=<known>` over a fixed window; assert JSON matches §6 contracts and labels map correctly.
- [ ] **Step 4:** Record the production URL `https://ad-lab.app.n8n.cloud/webhook/creativeos`.

---

## Phase 2 — Frontend types + API + pure helpers (TDD)

### Task 5: Response contract types

**Files:** Create `src/lib/creativeos-types.ts`

- [ ] **Step 1:** Define types exactly matching §6:
  ```ts
  export type CreativeStatus = "win" | "test" | "loss" | null;
  export interface DateRange { start: string; end: string }
  export interface ClientRollup {
    customerId: string; name: string; spend: number; views: number;
    viewRate: number; avgCpv: number; conversions: number;
    status: { win: number; test: number; loss: number };
  }
  export interface PortfolioResponse {
    window: DateRange;
    totals: { spend: number; views: number; conversions: number; clientsLive: number; winRate: number };
    clients: ClientRollup[];
    errors: { customerId: string; message: string }[];
  }
  export interface Creative {
    videoId: string | null; title: string; format: string; durationSec: number | null;
    impressions: number; views: number; viewRate: number; avgCpv: number; cost: number;
    conversions: number; conversionsValue: number;
    quartiles: { p25: number; p50: number; p75: number; p100: number } | null;
    status: CreativeStatus;
  }
  export interface DailyPoint { date: string; views: number; spend: number; viewRate: number; conversions: number }
  export interface ClientResponse {
    window: DateRange;
    account: { customerId: string; name: string };
    benchmarks: { viewRate: number; hook: number; cpv: number };
    creatives: Creative[];
    daily: DailyPoint[];
  }
  ```
- [ ] **Step 2:** Commit.

### Task 6: Pure helpers `defaultRange` + `normalizeStatus` (TDD)

**Files:** Create `src/lib/creativeos.ts`, `src/lib/creativeos.test.ts`

- [ ] **Step 1: Write failing tests** (`src/lib/creativeos.test.ts`):
  ```ts
  import { describe, it, expect } from "vitest";
  import { defaultRange, normalizeStatus, statusLabel } from "./creativeos";

  describe("defaultRange", () => {
    it("returns a 14-day window ending today (inclusive of 15 dates)", () => {
      const r = defaultRange(new Date("2026-06-25T00:00:00Z"));
      expect(r.end).toBe("2026-06-25");
      expect(r.start).toBe("2026-06-11");
    });
  });
  describe("normalizeStatus", () => {
    it("lowercases and maps loss->loss, unknown->null", () => {
      expect(normalizeStatus("WIN")).toBe("win");
      expect(normalizeStatus("Test")).toBe("test");
      expect(normalizeStatus("Loss")).toBe("loss");
      expect(normalizeStatus("")).toBeNull();
      expect(normalizeStatus(undefined)).toBeNull();
    });
  });
  describe("statusLabel", () => {
    it("maps loss to RETIRE for display", () => {
      expect(statusLabel("loss")).toBe("RETIRE");
      expect(statusLabel("win")).toBe("WIN");
      expect(statusLabel(null)).toBe("—");
    });
  });
  ```
- [ ] **Step 2:** Run `npx vitest run src/lib/creativeos.test.ts` — expect FAIL (not defined).
- [ ] **Step 3: Implement** in `src/lib/creativeos.ts`:
  ```ts
  import type { DateRange, CreativeStatus } from "./creativeos-types";

  export function defaultRange(today = new Date()): DateRange {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const start = new Date(today.getTime() - 14 * 864e5);
    return { start: iso(start), end: iso(today) };
  }
  export function normalizeStatus(raw?: string | null): CreativeStatus {
    const v = (raw ?? "").trim().toLowerCase();
    return v === "win" || v === "test" || v === "loss" ? v : null;
  }
  export function statusLabel(s: CreativeStatus): string {
    return s === "loss" ? "RETIRE" : s ? s.toUpperCase() : "—";
  }
  ```
- [ ] **Step 4:** Run tests — expect PASS.
- [ ] **Step 5:** Commit.

### Task 7: API fetchers

**Files:** Modify `src/lib/creativeos.ts`

- [ ] **Step 1:** Add fetchers using the same `Authorization: Bearer <VITE_WEBHOOK_KEY>` pattern as `src/lib/api.ts`:
  ```ts
  import type { PortfolioResponse, ClientResponse, DateRange } from "./creativeos-types";

  const CREATIVEOS_URL = "https://ad-lab.app.n8n.cloud/webhook/creativeos";
  const WEBHOOK_KEY = import.meta.env.VITE_WEBHOOK_KEY || "";
  const auth = { Authorization: `Bearer ${WEBHOOK_KEY}` };

  export async function fetchPortfolio(range: DateRange): Promise<PortfolioResponse> {
    const u = new URL(CREATIVEOS_URL);
    u.searchParams.set("scope", "portfolio");
    u.searchParams.set("start", range.start);
    u.searchParams.set("end", range.end);
    const res = await fetch(u, { headers: auth });
    if (!res.ok) throw new Error(`CreativeOS portfolio failed: ${res.status}`);
    return res.json();
  }
  export async function fetchClient(customerId: string, range: DateRange): Promise<ClientResponse> {
    const u = new URL(CREATIVEOS_URL);
    u.searchParams.set("scope", "client");
    u.searchParams.set("customerId", customerId);
    u.searchParams.set("start", range.start);
    u.searchParams.set("end", range.end);
    const res = await fetch(u, { headers: auth });
    if (!res.ok) throw new Error(`CreativeOS client failed: ${res.status}`);
    return res.json();
  }
  ```
- [ ] **Step 2:** Typecheck (`npx tsc --noEmit`) — expect clean. Commit.

---

## Phase 3 — Route + Index entry

### Task 8: Add `/creativeos` route

**Files:** Modify `src/App.tsx`

- [ ] **Step 1:** Import `CreativeOS` and add inside `<Routes>` above the catch-all, wrapped in `ProtectedRoute`:
  ```tsx
  <Route path="/creativeos" element={<ProtectedRoute><CreativeOS /></ProtectedRoute>} />
  ```
- [ ] **Step 2:** Create a minimal `src/pages/CreativeOS.tsx` placeholder (`export default () => <div>CreativeOS</div>`) so the route compiles.
- [ ] **Step 3:** `npm run build` — expect success. Commit.

### Task 9: Index entry card

**Files:** Modify `src/pages/Index.tsx`

- [ ] **Step 1:** Import `useNavigate` from `react-router-dom` and a `LayoutGrid` (or `Sparkles`) icon from `lucide-react`.
- [ ] **Step 2:** Add a 6th item to the report-type grid array (around line 373-398) — but since CreativeOS navigates rather than opening a form, render it as a card whose `onClick` calls `navigate("/creativeos")`. Title "CreativeOS", no "06" desc: "Live creative dashboard — all clients". Adjust the grid to `lg:grid-cols-6` (or keep 5 and place CreativeOS as a distinct highlighted card).
- [ ] **Step 3:** `npm run build`; manually verify the card appears and routes. Commit.

---

## Phase 4 — Shared UI atoms + design tokens

> Visual language from `youtube-report-template.html`: Plus Jakarta Sans + Space Grotesk, indigo brand (`#6366f1`/`#4f46e5`), light glass panels (`rgba(255,255,255,0.85)` + blur + subtle border). Load the two fonts (link or `@import`) scoped to this page.

### Task 10: GlassPanel, StatCard, StatusBadge

**Files:** Create `src/components/creativeos/GlassPanel.tsx`, `StatCard.tsx`, `StatusBadge.tsx`

- [ ] **Step 1:** `GlassPanel` — `div` with glass styles + rounded-2xl, accepts `className`/`children`.
- [ ] **Step 2:** `StatCard` — props `{ label, value, foot?, delta?, accent? }`; mirrors the youtube-template stat card (uppercase label, Space-Grotesk value).
- [ ] **Step 3:** `StatusBadge` — props `{ status: CreativeStatus }`; uses `statusLabel()`; win=emerald, test=violet, loss=rose, null=slate. (Add a tiny render test asserting `loss` shows "RETIRE".)
- [ ] **Step 4:** Run tests; commit.

### Task 11: CreativeCard

**Files:** Create `src/components/creativeos/CreativeCard.tsx`

- [ ] **Step 1:** Props `{ creative, rank? }`. YouTube thumbnail from `https://img.youtube.com/vi/{videoId}/hqdefault.jpg` with branded fallback on error (mirror youtube-template `thumbFallback`), play overlay, duration pill, rank chip, metric grid (VVR/Hook/Compl/Views/CPV/Conv), `StatusBadge`, and a "Watch on YouTube" link to `https://www.youtube.com/watch?v={videoId}` (hidden when `videoId` null).
- [ ] **Step 2:** Build; commit.

---

## Phase 5 — Shell, header, sidebar, topbar, states

### Task 12: states.tsx (Loading / Error / Empty)

**Files:** Create `src/components/creativeos/states.tsx`

- [ ] **Step 1:** `LoadingState` — skeleton stat cards + a "Pulling live from Google Ads…" line with an elapsed-seconds counter. `ErrorState` — message + `onRetry`. `EmptyState` — "No active video/Demand-Gen clients in this window".
- [ ] **Step 2:** Commit.

### Task 13: PageHeader (pink only for client)

**Files:** Create `src/components/creativeos/PageHeader.tsx`

- [ ] **Step 1:** Props `{ selectedClient?: ClientResponse["account"] | null, window, live }`.
  - When `selectedClient` is null → plain header (tab title, subtitle), **no gradient**.
  - When a client is selected → render the pink/gradient header (`bg-[#cb5dec]` like youtube-template, or the `.dc.html` GRAD) with client name, report period, account id, Live pill.
- [ ] **Step 2:** Render test: asserts the gradient element is absent when `selectedClient` is null and present when set. Run; commit.

### Task 14: Sidebar + Topbar

**Files:** Create `CreativeOSSidebar.tsx`, `CreativeOSTopbar.tsx`

- [ ] **Step 1:** `CreativeOSSidebar` — 5 tabs (`command`, `lab`, `hook`, `trend`, `vault`) with icons + active state; props `{ tab, onTab }`. Command Center always enabled; the other four require a selected client (disabled/tooltip when none).
- [ ] **Step 2:** `CreativeOSTopbar` — logo + "CreativeOS", account switcher (dropdown of `clients[]`, plus "All clients" to return to portfolio), date-range picker (presets: Last 7/14/28 days, MTD, Custom), and a Refresh button. Props: `{ clients, selectedId, onSelectClient, range, onRange, onRefresh, isFetching }`.
- [ ] **Step 3:** Build; commit.

---

## Phase 6 — Page shell wiring (queries, refresh, date range)

### Task 15: CreativeOS page shell

**Files:** Rewrite `src/pages/CreativeOS.tsx`

- [ ] **Step 1:** State: `tab` (default `command`), `selectedId` (default null = portfolio), `range` (default `defaultRange()`).
- [ ] **Step 2:** Queries (TanStack):
  ```tsx
  const portfolio = useQuery({ queryKey: ["creativeos","portfolio",range], queryFn: () => fetchPortfolio(range) });
  const client = useQuery({
    queryKey: ["creativeos","client",selectedId,range],
    queryFn: () => fetchClient(selectedId!, range),
    enabled: !!selectedId,
  });
  ```
  Portfolio auto-loads on open (no `enabled` gate). Selecting a client enables the client query. `onRefresh` calls `refetch` on the active query. Changing `range` changes the key → refetch. Selecting a client also switches `tab` away from `command` if still on it.
- [ ] **Step 3:** Layout: `CreativeOSTopbar` + flex row of `CreativeOSSidebar` + main column (`PageHeader` + `CreativeOSFilterBar` + tab content). Pass `selectedClient = selectedId ? client.data?.account : null` to `PageHeader`.
- [ ] **Step 4:** Render LoadingState/ErrorState/EmptyState based on the active query.
- [ ] **Step 5:** Build; commit.

### Task 16: FilterBar

**Files:** Create `src/components/creativeos/CreativeOSFilterBar.tsx`

- [ ] **Step 1:** Account/Format/Status chips + creative search input; props `{ statusFilter, onStatusFilter, search, onSearch }` (filters apply to client-scope tables). Commit.

---

## Phase 7 — Tab views

### Task 17: CommandCenter (portfolio)

**Files:** Create `src/components/creativeos/tabs/CommandCenter.tsx`

- [ ] **Step 1:** Props `{ data: PortfolioResponse, onSelectClient }`. Stat band (clients live, portfolio spend, blended win-rate, total views) + per-client cards (name, spend, view rate, win/test/loss counts, status dot) → clicking a card calls `onSelectClient(customerId)`. Render `errors[]` as a non-blocking notice.
- [ ] **Step 2:** Build; commit.

### Task 18: CreativeLab (client)

**Files:** Create `src/components/creativeos/tabs/CreativeLab.tsx`

- [ ] **Step 1:** Props `{ data: ClientResponse, statusFilter, search }`. Top-3 hero `CreativeCard`s (by viewRate) + sortable leaderboard table (impr, views, VVR, hook=p25, compl=p100, CPV, conv, status badge), shading cells below `benchmarks`. Apply status/search filters.
- [ ] **Step 2:** Build; commit.

### Task 19: HookRetention (client) + charts

**Files:** Create `tabs/HookRetention.tsx`, `charts/RetentionCurve.tsx`, `charts/QuartileFunnel.tsx`, `charts/HookRanking.tsx`

- [ ] **Step 1:** Build the three recharts wrappers (themed to match youtube-template colors).
- [ ] **Step 2:** `HookRetention` — quartile-funnel stat cards, retention curves (top creatives with non-null quartiles), hook-rate ranking (flag below benchmark), drop-off heatmap. **Creatives with `quartiles: null` are excluded from retention visuals** with a small "no quartile data (Demand Gen)" note.
- [ ] **Step 3:** Build; commit.

### Task 20: Trendlines (client)

**Files:** Create `tabs/Trendlines.tsx`, `charts/TrendChart.tsx`

- [ ] **Step 1:** Daily views vs spend (dual axis), daily view rate (with target line), daily conversions — from `data.daily`.
- [ ] **Step 2:** Build; commit.

### Task 21: WinningVault (portfolio + client)

**Files:** Create `tabs/WinningVault.tsx`

- [ ] **Step 1:** When a client is selected, show that client's `status==="win"` creatives as `CreativeCard`s, sortable. (Portfolio-wide vault is fed by per-client data; v1 shows the selected client's winners + a hint to pick a client.)
- [ ] **Step 2:** Build; commit.

---

## Phase 8 — Verification

### Task 22: Test suite + typecheck + build

- [ ] **Step 1:** `npx vitest run` — all green.
- [ ] **Step 2:** `npx tsc --noEmit` — clean.
- [ ] **Step 3:** `npm run build` — success.
- [ ] **Step 4:** Commit any fixups.

### Task 23: Manual end-to-end (use the `run` / webapp-testing skill)

- [ ] **Step 1:** Start dev server; open `/creativeos`. Confirm: portfolio auto-loads (stat band + client cards), **no pink header**.
- [ ] **Step 2:** Select a client → client queries fire, **pink header appears**, tabs (Lab/Hook/Trend/Vault) populate.
- [ ] **Step 3:** Change date range to Last 28 days → refetch occurs with new window.
- [ ] **Step 4:** Click Refresh → active query refetches; loading indicator shows.
- [ ] **Step 5:** Verify a Demand Gen creative with no quartiles renders metrics but is excluded from retention visuals.
- [ ] **Step 6:** Verify a forced webhook error shows ErrorState + Retry, and a per-account error shows the non-blocking notice.

---

## Notes
- DRY: reuse `statusLabel`/`normalizeStatus` everywhere; reuse the youtube-template thumbnail fallback pattern in `CreativeCard`.
- YAGNI: no auto-poll, no Supabase persistence, no excluded tabs.
- Frequent commits: one per task as marked.
- Cache escape hatch (spec §4.1) is a workflow-only change later; the frontend contract does not change.
