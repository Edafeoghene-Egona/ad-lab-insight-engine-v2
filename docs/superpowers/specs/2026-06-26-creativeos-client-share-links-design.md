# CreativeOS Client Share Links — Design

**Date:** 2026-06-26
**Status:** Approved (design), pending implementation plan
**Author:** Edafe (with Claude)

## Summary

Allow signed-in `@ad-lab.io` users to generate a stable, revocable, shareable link
for any individual client's CreativeOS deep-dive dashboard. A client opening the link
sees **live** data scoped to **their account only** — no sign-in required, no client
switcher, no portfolio/Command Center view, and no ability to widen scope to other
clients.

## Goals

- One reusable, stable link per client (copy repeatedly; URL does not change per copy).
- Links are **revocable** at any time, and can be **regenerated** (new token).
- The shared view shows **live** data (re-fetched each visit), with the same deep-dive
  tabs and side navigation the internal team uses, **excluding** Command Center.
- The client can change the date range (live, not date-locked); default = last 14 days.

## Non-Goals (YAGNI)

- No auto-expiry of links (only manual revoke).
- No access logging / open counts / last-seen tracking.
- No snapshotting/freezing of data.
- No new branded client-facing layout — reuse the existing deep-dive UI.
- No changes to the n8n webhook contract.

## Context (current architecture)

- **Stack:** Vite + React 18 SPA, React Router v6, shadcn/ui, TanStack Query.
- **Server:** thin Express `server.js` (`npm start` → `node server.js`) that serves
  the built `dist/` and SPA-catch-alls. Real long-running Node host.
- **Auth:** Supabase Auth; `ProtectedRoute` requires a session **and** an `@ad-lab.io`
  email. Public route precedent already exists (`/shared/:id`, no `ProtectedRoute`).
- **Data:** n8n webhook `https://ad-lab.app.n8n.cloud/webhook/creativeos`, called
  directly from the browser in `src/lib/creativeos.ts` with a `Bearer` token read from
  `VITE_WEBHOOK_KEY`. Clients are identified by `customerId`.
  - `fetchPortfolio(range)` → `scope=portfolio`
  - `fetchClient(customerId, range)` → `scope=client&customerId=…`
- **Deep dive:** `src/pages/CreativeOS.tsx` drives everything off `selectedId` +
  `tab`/`sub` state. Tabs are defined in `CreativeOSSidebar.tsx`:
  - `command` (Command Center, portfolio, `clientOnly: false`)
  - `lab`, `hook`, `trend`, `vault` (all `clientOnly: true`)
  - Tab content components (`CreativeLab`, `HookRetention`, `Trendlines`,
    `WinningVault`) already take a `data: ClientResponse` prop — cleanly reusable.

## Key constraint that drives the design

Because the SPA is a pure browser app, **`VITE_WEBHOOK_KEY` is bundled into the client**
and any frontend-only scoping is bypassable. This is acceptable today because every
dashboard user is a trusted `@ad-lab.io` employee. A **public** share page must NOT:

1. expose the webhook key, or
2. allow a tampered token/`customerId` to read another client or the whole portfolio.

Therefore the shared view's live data must flow through a **server-side proxy** that
holds the secret and binds each token to exactly one `customerId`. **Decision: the proxy
lives in the existing Express `server.js`** (same repo, same deploy, fewest moving parts).

## Architecture

```
Client browser ──GET /c/:token (public SPA route)──► ClientShareView
        │
        └─GET /api/share/:token?start&end──► Express server.js proxy
                                                  │  (service-role Supabase read)
                                                  ├─ lookup client_share_links by token
                                                  ├─ if missing → 404 / if revoked → 403
                                                  └─ fetch n8n scope=client&customerId=<bound>
                                                       with server-only WEBHOOK_KEY
                                                  ◄─ ClientResponse JSON (no key, no foreign ids)
```

### Component 1 — Supabase table `client_share_links`

New migration under `supabase/migrations/`.

| column | type | notes |
|---|---|---|
| `id` | uuid PK | default `gen_random_uuid()` |
| `customer_id` | text **UNIQUE** | bound Google Ads id (unique ⇒ one reusable link/client) |
| `client_name` | text | display name captured at creation |
| `token` | text **UNIQUE** | high-entropy URL secret: base64url of 32 random bytes |
| `revoked` | boolean | default `false` |
| `created_by` | uuid | `auth.uid()` |
| `created_at` | timestamptz | default `now()` |

**RLS policies** — `select`, `insert`, `update` allowed only when the requester is
authenticated and their email ends with `@ad-lab.io` (mirrors `ProtectedRoute`'s rule).
No public/anon policy: the share page never reads this table with the anon key; only the
server proxy reads it via the **service-role** key (bypasses RLS). No `delete` needed
(revoke is an update); regenerate is an update that sets a new `token` and `revoked=false`.

- **What it does:** stores the token↔client binding and revocation state.
- **How it's used:** written by the authenticated dashboard (manage UI); read by the
  server proxy.
- **Depends on:** Supabase, `auth.uid()`/JWT email claim.

### Component 2 — Server proxy `GET /api/share/:token` (in `server.js`)

- Adds `@supabase/supabase-js` service-role client (`SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` from `process.env`).
- Reads `WEBHOOK_KEY` from `process.env` — **server-only, not `VITE_`-prefixed**, never
  bundled.
- Flow:
  1. Read `:token`, `start`, `end` (validate `start`/`end` are ISO `YYYY-MM-DD`; fall
     back to a server-computed last-14-days default if absent/invalid).
  2. `select * from client_share_links where token = :token` (single row).
  3. Missing row → `404`; `revoked = true` → `403`.
  4. `fetch` n8n `scope=client&customerId=<row.customer_id>&start&end` with
     `Authorization: Bearer ${WEBHOOK_KEY}`.
  5. On n8n non-2xx → `502`. On success → return the `ClientResponse` JSON to the client.
- The proxy never echoes the raw `customer_id` or the webhook key; the response is the
  same `ClientResponse` shape the tab components already consume.
- **Testability:** factor the lookup + n8n fetch into a small module
  (e.g. `server/share-proxy.js` or similar) with the Supabase client and `fetch`
  injectable, so vitest can cover: valid token, missing token (404), revoked (403),
  n8n failure (502), date defaulting. `server.js` stays thin (wires Express → module).
- **Dev environment:** add a Vite `server.proxy` entry so `/api` forwards to the Express
  server during `npm run dev` (Vite serves the SPA in dev; Express only serves built
  `dist`). Document the env vars the dev server needs.

### Component 3 — Public route + `ClientShareView`

- `App.tsx`: add `<Route path="/c/:token" element={<ClientShareView />} />` **without**
  `ProtectedRoute`.
- `ClientShareView` (new page):
  - Reads `token` from the route; owns its own state: `range` (default last-14-days),
    `tab` (default `lab`), `sub`, and drawer (`drawerCreative`).
  - `useQuery(["share", token, range])` → `GET /api/share/:token?start&end`.
  - Renders loading/error/empty states reusing `LoadingState` / `ErrorState` /
    `EmptyState`. A `404`/`403` response renders a friendly terminal state:
    "This link is no longer active." (not a retry-able error).
  - Renders tab content with the **existing** components (`CreativeLab`,
    `HookRetention`, `Trendlines`, `WinningVault`) passing the fetched `data`.
  - Reuses `CreativeDrawer` for creative detail.

### Component 4 — Variant chrome (topbar + sidebar)

Rather than fork the components:

- **`CreativeOSTopbar`**: add a `hideSwitcher`/share-mode prop. In share mode it renders
  the Ad-Lab logo + client name + date-range control only — no client switcher, no
  refresh-against-portfolio coupling, no "Insight Engine"/"Back to portfolio" affordances.
- **`CreativeOSSidebar`**: accept an optional subset of `TabId`s to render
  (e.g. `tabs?: TabId[]`); the share view passes `["lab","hook","trend","vault"]`,
  omitting `command`. Default behavior (all tabs) unchanged for the internal page.

### Component 5 — Share management UI (signed-in only)

- Add a **"Share"** button to the deep-dive `PageHeader`, rendered only when a client is
  selected (i.e., `selectedId` set) — internal dashboard only.
- Clicking opens a shadcn `Dialog`:
  - On open, fetch the existing row for this `customer_id` (authenticated Supabase
    client, RLS). If none exists, **create** it: generate token (base64url of 32 random
    bytes), `insert` `{ customer_id, client_name, token, created_by }`.
  - Display the full share URL (`<origin>/c/<token>`) with a **Copy** button.
  - **Revoke** action → `update revoked = true` (link immediately stops working via the
    proxy's `403`).
  - **Regenerate** action → `update` with a fresh `token` and `revoked = false` (old URL
    dies, new URL issued).
- A small data module (e.g. `src/lib/client-share-links.ts`) wraps
  get-or-create / revoke / regenerate against Supabase, unit-testable in isolation.

## Data flow (live request)

1. Internal user opens a client deep dive → clicks **Share** → gets/copies
   `https://<host>/c/<token>`.
2. Client opens the URL → SPA route `/c/:token` mounts `ClientShareView`.
3. `ClientShareView` calls `GET /api/share/:token?start&end`.
4. Express proxy validates token via service-role read, calls n8n with the bound
   `customer_id` and server-only key, returns `ClientResponse`.
5. View renders the deep-dive tabs (lab/hook/trend/vault) for that client. Changing the
   date range re-issues step 3.

## Error handling

| Situation | Proxy | Share view |
|---|---|---|
| Unknown token | `404` | "This link is no longer active." (terminal) |
| Revoked token | `403` | "This link is no longer active." (terminal) |
| n8n failure | `502` | `ErrorState` with retry |
| No data in range | `200` empty | `EmptyState` ("try widening the range") |
| Bad/missing dates | proxy defaults to last 14 days | normal render |

## Security model

- Webhook key is server-only (`process.env.WEBHOOK_KEY`); never shipped to the public.
- Scope is enforced **server-side per token** — the bound `customer_id` is the only
  account a token can ever read. Editing the URL/token cannot widen scope.
- `client_share_links` is unreadable to anon/public; only the service-role proxy and
  `@ad-lab.io`-authenticated users (RLS) touch it.
- Tokens are high-entropy (32 random bytes) and unguessable; revocation is immediate.
- Pre-existing exposure of `VITE_WEBHOOK_KEY` to internal signed-in users is unchanged
  and out of scope for this feature (the share path deliberately does not rely on it).

## Testing strategy

- **Server proxy module (vitest):** valid token → calls n8n with bound id; missing →
  404; revoked → 403; n8n error → 502; date validation/defaulting.
- **Share links data module (vitest):** get-or-create returns existing vs inserts new;
  revoke sets flag; regenerate rotates token + clears revoked.
- **Component:** `ClientShareView` renders only lab/hook/trend/vault tabs, no switcher,
  no Command Center; terminal state on 404/403.
- **Manual/E2E:** create link → open in a logged-out browser → see only that client;
  revoke → link shows inactive; regenerate → old dead, new works.

## Affected / new files

- New: `supabase/migrations/<ts>_client_share_links.sql`
- New: `src/pages/ClientShareView.tsx`
- New: `src/lib/client-share-links.ts`
- New: server proxy module (e.g. `server/share-proxy.js`) + tests
- Edit: `server.js` (wire proxy + service-role client + `WEBHOOK_KEY`)
- Edit: `vite.config.ts` (dev `/api` proxy)
- Edit: `src/App.tsx` (public `/c/:token` route)
- Edit: `src/components/creativeos/CreativeOSTopbar.tsx` (`hideSwitcher`/share mode)
- Edit: `src/components/creativeos/CreativeOSSidebar.tsx` (`tabs?` subset prop)
- Edit: `src/components/creativeos/PageHeader.tsx` (Share button) + new Share dialog
- Env: add `SUPABASE_SERVICE_ROLE_KEY` and `WEBHOOK_KEY` (non-VITE) to the server env.

## Open questions / assumptions

- Assumes the production host runs `server.js` (Node), consistent with `npm start`. If
  the SPA is ever deployed as pure static hosting, the proxy must move to a serverless
  function (Supabase Edge Function was the considered alternative).
- Assumes the n8n webhook's `scope=client` response for a given `customerId` contains no
  cross-client data.
