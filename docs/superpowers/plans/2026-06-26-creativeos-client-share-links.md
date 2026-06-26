# CreativeOS Client Share Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in `@ad-lab.io` users generate a stable, revocable share link per client that shows a logged-out client their own live CreativeOS deep-dive (lab/hook/trend/vault), scoped server-side so no other client's data is reachable.

**Architecture:** A public SPA route `/c/:token` renders `ClientShareView`, which fetches live data from a new Express endpoint `GET /api/share/:token`. That endpoint holds the webhook secret server-side, looks the token up in a new Supabase `client_share_links` table via the service-role key, and proxies a `scope=client` call to n8n bound to the one `customer_id` the token maps to. Signed-in users manage links (create-once / copy / revoke / regenerate) from a dialog on the deep-dive page header.

**Tech Stack:** Vite + React 18 SPA, React Router v6, TanStack Query, shadcn/ui (Radix Dialog), Supabase (Postgres + Auth + service role), Express (`server.js`), n8n webhook, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-26-creativeos-client-share-links-design.md`

---

## File Structure

**New files**
- `supabase/migrations/<timestamp>_client_share_links.sql` — table + RLS.
- `src/lib/date-range.ts` — framework-free `defaultRange()` (+ `isIsoDate`), shared by client and server.
- `server/share-proxy.mjs` — pure, dependency-injected `resolveShareData()` (token → validated → n8n) used by `server.js`.
- `server/share-proxy.test.ts` — vitest unit tests for the proxy logic.
- `src/lib/client-share-links.ts` — authenticated Supabase wrapper: `getShareLink`, `createShareLink`, `getOrCreateShareLink`, `setRevoked`, `regenerateShareLink`, `generateShareToken`, `shareUrl`.
- `src/lib/client-share-links.test.ts` — vitest unit tests with a faked Supabase client.
- `src/components/creativeos/ShareLinkDialog.tsx` — the manage-link dialog.
- `src/pages/ClientShareView.tsx` — the public deep-dive page.
- `src/pages/ClientShareView.test.tsx` — render/scope tests.

**Modified files**
- `src/lib/creativeos.ts` — re-export `defaultRange` from `date-range.ts` (no duplicate logic).
- `vitest.config.ts` — extend `include` to cover `server/**` tests.
- `vite.config.ts` — dev `server.proxy` forwarding `/api` to the Express server.
- `package.json` — `dev:server` + `dev:all` scripts (+ `concurrently` devDep).
- `server.js` — service-role Supabase client, `WEBHOOK_KEY` from env, `GET /api/share/:token` route, `express.json()` not needed (GET only).
- `src/components/creativeos/CreativeOSSidebar.tsx` — optional `tabs?: TabId[]` subset prop.
- `src/components/creativeos/CreativeOSTopbar.tsx` — optional `shareMode?: boolean` (hide switcher/refresh).
- `src/components/creativeos/PageHeader.tsx` — optional `onShare?: () => void` to render a Share button.
- `src/pages/CreativeOS.tsx` — wire the Share button + `ShareLinkDialog`.
- `src/App.tsx` — public `/c/:token` route (no `ProtectedRoute`).
- `.env.example` (create if absent) — document `SUPABASE_SERVICE_ROLE_KEY`, `WEBHOOK_KEY`.

**Conventions to follow**
- ESM throughout (`server.js` already uses `import`). The proxy module is `.mjs` so raw `node server.js` can import it without a TS step.
- Tab content components already accept `data: ClientResponse` plus `sub` and (lab/hook/vault) `onOpenCreative` — wire all three.
- RLS mirrors `ProtectedRoute`: authenticated AND email ends with `@ad-lab.io`.

---

## Task 1: Supabase migration — `client_share_links` table + RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_client_share_links.sql` (timestamp format: copy the style of the newest existing file in `supabase/migrations/`, e.g. `20260626120000_client_share_links.sql`)

- [ ] **Step 1: Inspect an existing migration for conventions**

Run: `ls supabase/migrations && cat "$(ls supabase/migrations | tail -1 | xargs -I{} echo supabase/migrations/{})"`
Expected: see naming/timestamp format and how RLS policies are written in this project.

- [ ] **Step 2: Write the migration**

Create the file with:

```sql
-- client_share_links: one reusable, revocable public link per client.
create table if not exists public.client_share_links (
  id uuid primary key default gen_random_uuid(),
  customer_id text not null unique,
  client_name text not null,
  token text not null unique,
  revoked boolean not null default false,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists client_share_links_token_idx on public.client_share_links (token);

alter table public.client_share_links enable row level security;

-- Only authenticated @ad-lab.io users may read/manage links.
-- The public share page never reads this table; the server proxy uses the
-- service-role key, which bypasses RLS.
create policy "ad-lab users read share links"
  on public.client_share_links for select
  to authenticated
  using ( (auth.jwt() ->> 'email') like '%@ad-lab.io' );

create policy "ad-lab users insert share links"
  on public.client_share_links for insert
  to authenticated
  with check ( (auth.jwt() ->> 'email') like '%@ad-lab.io' );

create policy "ad-lab users update share links"
  on public.client_share_links for update
  to authenticated
  using ( (auth.jwt() ->> 'email') like '%@ad-lab.io' )
  with check ( (auth.jwt() ->> 'email') like '%@ad-lab.io' );
```

- [ ] **Step 3: Apply locally (if a local Supabase is running) or push**

Run (whichever the project uses): `npx supabase db push` (or `npx supabase migration up` for a local stack).
Expected: migration applies with no error; table `client_share_links` exists. If no Supabase CLI/stack is available locally, note that and apply via the Supabase dashboard SQL editor; do not block the rest of the plan.

- [ ] **Step 4: (If applicable) regenerate Supabase types**

Run the project's type-gen command if one exists (check `package.json`/README; commonly `npx supabase gen types typescript --local > src/integrations/supabase/types.ts`).
Expected: `client_share_links` appears in `src/integrations/supabase/types.ts`. If no generator is wired, manually add the table to `Database["public"]["Tables"]` in `types.ts` so `client-share-links.ts` is typed.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations src/integrations/supabase/types.ts
git commit -m "feat(creativeos): add client_share_links table + RLS"
```

---

## Task 2: Extract shared `defaultRange` date helper (DRY)

The proxy and client must share one date implementation. `defaultRange()` currently lives in `src/lib/creativeos.ts` (lines ~10-14). Move it to a framework-free module and re-export.

**Files:**
- Create: `src/lib/date-range.ts`
- Create: `src/lib/date-range.test.ts`
- Modify: `src/lib/creativeos.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/date-range.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { defaultRange, isIsoDate } from "./date-range";

describe("date-range", () => {
  it("defaultRange returns a 14-day inclusive ISO window from the given day", () => {
    const r = defaultRange(new Date("2026-06-26T00:00:00Z"));
    expect(r).toEqual({ start: "2026-06-12", end: "2026-06-26" });
  });

  it("isIsoDate accepts YYYY-MM-DD and rejects junk", () => {
    expect(isIsoDate("2026-06-26")).toBe(true);
    expect(isIsoDate("2026-6-2")).toBe(false);
    expect(isIsoDate("nope")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/date-range.test.ts`
Expected: FAIL — cannot resolve `./date-range`.

- [ ] **Step 3: Implement `date-range.ts`**

```ts
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
```

- [ ] **Step 4: Re-export from `creativeos.ts` (remove the duplicate)**

In `src/lib/creativeos.ts`, delete the local `defaultRange` definition (and its `iso` helper if unused elsewhere) and add near the top:

```ts
export { defaultRange } from "./date-range";
```

Verify nothing else in `creativeos.ts` still references a now-deleted local `iso` (the money/format helpers have their own logic — leave them).

- [ ] **Step 5: Run the full suite to verify nothing broke**

Run: `npx vitest run src/lib/date-range.test.ts src/lib/creativeos.test.ts`
Expected: PASS (existing `creativeos.test.ts` still green; new test green).

- [ ] **Step 6: Commit**

```bash
git add src/lib/date-range.ts src/lib/date-range.test.ts src/lib/creativeos.ts
git commit -m "refactor(creativeos): extract shared defaultRange/isIsoDate date helper"
```

---

## Task 3: Server proxy logic — `resolveShareData` (TDD)

Pure, dependency-injected so it tests without a network or DB. Returns `{ status, body }`.

**Files:**
- Create: `server/share-proxy.mjs`
- Create: `server/share-proxy.test.ts`
- Modify: `vitest.config.ts`

- [ ] **Step 1: Extend vitest include to cover `server/`**

In `vitest.config.ts`, change the `include` line to:

```ts
include: ["src/**/*.{test,spec}.{ts,tsx}", "server/**/*.{test,spec}.{ts,js}"],
```

- [ ] **Step 2: Write the failing test**

`server/share-proxy.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { resolveShareData } from "./share-proxy.mjs";

/** Build a fake supabase whose maybeSingle() resolves to `row`. */
function fakeSupabase(row: unknown) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
  };
  return { from: () => chain };
}

const deps = (row: unknown, fetchImpl: typeof fetch) => ({
  supabase: fakeSupabase(row),
  fetchImpl,
  webhookKey: "secret",
  n8nUrl: "https://n8n.example/webhook/creativeos",
});

describe("resolveShareData", () => {
  it("returns 404 when the token is unknown", async () => {
    const res = await resolveShareData(
      { token: "nope" },
      deps(null, vi.fn()),
    );
    expect(res.status).toBe(404);
  });

  it("returns 403 when the link is revoked", async () => {
    const res = await resolveShareData(
      { token: "t" },
      deps({ customer_id: "123", revoked: true }, vi.fn()),
    );
    expect(res.status).toBe(403);
  });

  it("calls n8n with the bound customer_id + bearer key and returns its body", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ account: { name: "Acme" }, creatives: [] }),
    });
    const res = await resolveShareData(
      { token: "t", start: "2026-06-01", end: "2026-06-14" },
      deps({ customer_id: "123", revoked: false }, fetchImpl),
    );
    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toContain("scope=client");
    expect(calledUrl).toContain("customerId=123");
    expect(calledUrl).toContain("start=2026-06-01");
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe("Bearer secret");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ account: { name: "Acme" }, creatives: [] });
  });

  it("defaults the date window when start/end are missing or malformed", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    await resolveShareData(
      { token: "t", start: "garbage" },
      deps({ customer_id: "123", revoked: false }, fetchImpl),
    );
    const calledUrl = String(fetchImpl.mock.calls[0][0]);
    expect(calledUrl).toMatch(/start=\d{4}-\d{2}-\d{2}/);
    expect(calledUrl).toMatch(/end=\d{4}-\d{2}-\d{2}/);
  });

  it("returns 502 when n8n fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const res = await resolveShareData(
      { token: "t" },
      deps({ customer_id: "123", revoked: false }, fetchImpl),
    );
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run server/share-proxy.test.ts`
Expected: FAIL — cannot resolve `./share-proxy.mjs`.

- [ ] **Step 4: Implement `server/share-proxy.mjs`**

```js
// Pure share-link resolution. No Express, no env reads — everything is injected
// so it unit-tests without a network or database.

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isIso = (v) => typeof v === "string" && ISO.test(v);
const iso = (d) => d.toISOString().slice(0, 10);

function windowFrom(start, end) {
  if (isIso(start) && isIso(end)) return { start, end };
  const today = new Date();
  return { start: iso(new Date(today.getTime() - 14 * 864e5)), end: iso(today) };
}

/**
 * @param {{token:string,start?:string,end?:string}} params
 * @param {{supabase:any,fetchImpl:typeof fetch,webhookKey:string,n8nUrl:string}} deps
 * @returns {Promise<{status:number, body?:unknown}>}
 */
export async function resolveShareData({ token, start, end }, deps) {
  const { supabase, fetchImpl, webhookKey, n8nUrl } = deps;

  const { data: row, error } = await supabase
    .from("client_share_links")
    .select("customer_id, revoked")
    .eq("token", token)
    .maybeSingle();

  if (error) return { status: 500 };
  if (!row) return { status: 404 };
  if (row.revoked) return { status: 403 };

  const w = windowFrom(start, end);
  const u = new URL(n8nUrl);
  u.searchParams.set("scope", "client");
  u.searchParams.set("customerId", row.customer_id);
  u.searchParams.set("start", w.start);
  u.searchParams.set("end", w.end);

  const res = await fetchImpl(u, { headers: { Authorization: `Bearer ${webhookKey}` } });
  if (!res.ok) return { status: 502 };
  return { status: 200, body: await res.json() };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/share-proxy.test.ts`
Expected: PASS (all 5).

- [ ] **Step 6: Commit**

```bash
git add server/share-proxy.mjs server/share-proxy.test.ts vitest.config.ts
git commit -m "feat(creativeos): add share-link proxy resolver with tests"
```

---

## Task 4: Wire the proxy into `server.js`

**Files:**
- Modify: `server.js`
- Create: `.env.example` (if absent)

- [ ] **Step 1: Add the service-role client, env, and route to `server.js`**

Insert imports + setup near the top (after the existing imports) and the route **before** the SPA catch-all (`app.get('*', …)`):

```js
import { createClient } from '@supabase/supabase-js';
import { resolveShareData } from './server/share-proxy.mjs';

const WEBHOOK_KEY = process.env.WEBHOOK_KEY || '';
const N8N_URL = process.env.CREATIVEOS_WEBHOOK_URL || 'https://ad-lab.app.n8n.cloud/webhook/creativeos';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Public, scoped client share-link data proxy. Holds the webhook secret
// server-side; the token can only ever resolve to its bound customer_id.
app.get('/api/share/:token', async (req, res) => {
  try {
    const result = await resolveShareData(
      { token: req.params.token, start: req.query.start, end: req.query.end },
      { supabase: supabaseAdmin, fetchImpl: fetch, webhookKey: WEBHOOK_KEY, n8nUrl: N8N_URL },
    );
    if (result.status !== 200) return res.sendStatus(result.status);
    res.json(result.body);
  } catch (err) {
    console.error('share proxy error', err);
    res.sendStatus(500);
  }
});
```

(`fetch` is global in Node 18+. Confirm `@supabase/supabase-js` is already a dependency — it is, used by the client.)

- [ ] **Step 2: Document env vars**

Create/append `.env.example`:

```
# Server-only (NOT exposed to the browser):
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WEBHOOK_KEY=
# Optional override (defaults to the production n8n webhook):
# CREATIVEOS_WEBHOOK_URL=
```

- [ ] **Step 3: Smoke-test the endpoint against a built app**

Run:
```bash
npm run build
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... WEBHOOK_KEY=... node server.js &
curl -i localhost:3000/api/share/does-not-exist
```
Expected: `HTTP/1.1 404`. (If real Supabase env isn't available locally, note this and rely on the Task 3 unit tests + the Task 10 manual check.) Kill the server afterward.

- [ ] **Step 4: Commit**

```bash
git add server.js .env.example
git commit -m "feat(creativeos): serve /api/share/:token from express"
```

---

## Task 5: Dev `/api` proxy + dev scripts

In dev, Vite serves the SPA on `:8080` and Express serves `:3000`. Forward `/api` so `/c/:token` works locally.

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Add the dev proxy to `vite.config.ts`**

Inside the `server: { … }` block, add:

```ts
    proxy: {
      "/api": { target: "http://localhost:3000", changeOrigin: true },
    },
```

- [ ] **Step 2: Add dev scripts + concurrently**

Run: `npm install -D concurrently`
Then add to `package.json` `scripts`:

```json
    "dev:server": "node server.js",
    "dev:all": "concurrently -n vite,api -c blue,magenta \"npm run dev\" \"npm run dev:server\"",
```

Note in the team docs that `dev:all` requires the server env vars from Task 4. For pure UI work `npm run dev` alone is fine; the share route just won't fetch.

- [ ] **Step 3: Verify config still boots**

Run: `npm run dev` (then stop it). Expected: Vite starts on `:8080` with no config error.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts package.json package-lock.json
git commit -m "chore(creativeos): dev proxy + dev:all script for share api"
```

---

## Task 6: Client-side share-link data module (TDD)

Authenticated Supabase wrapper used by the manage dialog. The "one reusable link per client" rule = get-or-create on `customer_id`.

**Files:**
- Create: `src/lib/client-share-links.ts`
- Create: `src/lib/client-share-links.test.ts`

- [ ] **Step 1: Write the failing test**

`src/lib/client-share-links.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { generateShareToken, shareUrl, getOrCreateShareLink } from "./client-share-links";

describe("share token + url", () => {
  it("generateShareToken returns a long url-safe string", () => {
    const t = generateShareToken();
    expect(t.length).toBeGreaterThanOrEqual(40);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(generateShareToken()).not.toBe(t);
  });

  it("shareUrl builds an absolute /c/<token> link", () => {
    expect(shareUrl("abc", "https://app.ad-lab.io")).toBe("https://app.ad-lab.io/c/abc");
  });
});

describe("getOrCreateShareLink", () => {
  it("returns the existing row when one already exists", async () => {
    const existing = { id: "1", customer_id: "123", client_name: "Acme", token: "tok", revoked: false };
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: existing, error: null }) }) }),
      }),
    };
    const row = await getOrCreateShareLink({ customerId: "123", clientName: "Acme" }, { supabase, userId: "u1" });
    expect(row).toEqual(existing);
  });

  it("inserts a new row (with a generated token) when none exists", async () => {
    const insertSpy = vi.fn((payload) => ({
      select: () => ({ single: () => Promise.resolve({ data: { id: "2", ...payload }, error: null }) }),
    }));
    const supabase = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
        insert: insertSpy,
      }),
    };
    const row = await getOrCreateShareLink({ customerId: "999", clientName: "Beta" }, { supabase, userId: "u1" });
    expect(insertSpy).toHaveBeenCalledOnce();
    const payload = insertSpy.mock.calls[0][0];
    expect(payload.customer_id).toBe("999");
    expect(payload.client_name).toBe("Beta");
    expect(payload.created_by).toBe("u1");
    expect(payload.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(row.customer_id).toBe("999");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/client-share-links.test.ts`
Expected: FAIL — cannot resolve `./client-share-links`.

- [ ] **Step 3: Implement `src/lib/client-share-links.ts`**

```ts
import { supabase as defaultSupabase } from "@/integrations/supabase/client";

export interface ShareLinkRow {
  id: string;
  customer_id: string;
  client_name: string;
  token: string;
  revoked: boolean;
}

/** 32 random bytes, base64url — an unguessable URL secret. */
export function generateShareToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function shareUrl(token: string, origin: string = window.location.origin): string {
  return `${origin}/c/${token}`;
}

const COLS = "id, customer_id, client_name, token, revoked";

type Deps = { supabase?: any; userId: string };

export async function getShareLink(
  customerId: string,
  supabase: any = defaultSupabase,
): Promise<ShareLinkRow | null> {
  const { data, error } = await supabase
    .from("client_share_links")
    .select(COLS)
    .eq("customer_id", customerId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function createShareLink(
  args: { customerId: string; clientName: string },
  deps: Deps,
): Promise<ShareLinkRow> {
  const supabase = deps.supabase ?? defaultSupabase;
  const payload = {
    customer_id: args.customerId,
    client_name: args.clientName,
    token: generateShareToken(),
    created_by: deps.userId,
  };
  const { data, error } = await supabase
    .from("client_share_links")
    .insert(payload)
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}

export async function getOrCreateShareLink(
  args: { customerId: string; clientName: string },
  deps: Deps,
): Promise<ShareLinkRow> {
  const existing = await getShareLink(args.customerId, deps.supabase);
  return existing ?? createShareLink(args, deps);
}

export async function setRevoked(
  customerId: string,
  revoked: boolean,
  supabase: any = defaultSupabase,
): Promise<void> {
  const { error } = await supabase
    .from("client_share_links")
    .update({ revoked })
    .eq("customer_id", customerId);
  if (error) throw error;
}

export async function regenerateShareLink(
  customerId: string,
  supabase: any = defaultSupabase,
): Promise<ShareLinkRow> {
  const { data, error } = await supabase
    .from("client_share_links")
    .update({ token: generateShareToken(), revoked: false })
    .eq("customer_id", customerId)
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/client-share-links.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/client-share-links.ts src/lib/client-share-links.test.ts
git commit -m "feat(creativeos): client share-link data module (get-or-create/revoke/regenerate)"
```

---

## Task 7: Sidebar tab-subset prop

Let the share view render only `lab/hook/trend/vault`.

**Files:**
- Modify: `src/components/creativeos/CreativeOSSidebar.tsx`
- Create: `src/components/creativeos/CreativeOSSidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreativeOSSidebar } from "./CreativeOSSidebar";

describe("CreativeOSSidebar", () => {
  it("renders only the provided tab subset", () => {
    render(<CreativeOSSidebar tab="lab" onTab={() => {}} hasClient tabs={["lab", "hook", "trend", "vault"]} />);
    expect(screen.queryByText("Command Center")).toBeNull();
    expect(screen.getByText("Creative Testing Lab")).toBeTruthy();
    expect(screen.getByText("Winning Vault")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/creativeos/CreativeOSSidebar.test.tsx`
Expected: FAIL — `tabs` prop not supported; Command Center still rendered.

- [ ] **Step 3: Add the prop**

In `CreativeOSSidebar.tsx`, extend `SidebarProps` with `tabs?: TabId[];` and filter:

```tsx
export function CreativeOSSidebar({ tab, onTab, hasClient, tabs }: SidebarProps) {
  const visible = tabs ? TABS.filter((t) => tabs.includes(t.id)) : TABS;
  return (
    <nav className="...">
      {visible.map((t) => {
        // ...unchanged...
```

(Only change the iterated array from `TABS` to `visible`; leave everything else.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/creativeos/CreativeOSSidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/creativeos/CreativeOSSidebar.tsx src/components/creativeos/CreativeOSSidebar.test.tsx
git commit -m "feat(creativeos): sidebar tab-subset prop"
```

---

## Task 8: Topbar share mode (hide switcher/refresh)

**Files:**
- Modify: `src/components/creativeos/CreativeOSTopbar.tsx`

- [ ] **Step 1: Add a `shareMode` prop**

Extend `TopbarProps` with `shareMode?: boolean;`. When `shareMode` is true:
- Render the Ad-Lab logo + the selected client's name (from `selectedId`/`clients`, or a passed-in label) + the date-range control only.
- Do **not** render the account switcher dropdown or the refresh-against-portfolio button.

Keep the change minimal: wrap the switcher and refresh JSX in `{!shareMode && ( … )}`. The date-range popover stays. Since the share view has a single client, pass `clients={[]}` and rely on a display name; add an optional `clientLabel?: string` prop used when `shareMode` and `clients` is empty so the name still shows.

- [ ] **Step 2: Manual visual check**

Run: `npm run dev`, temporarily render the topbar with `shareMode` (or defer the visual check to Task 10 where it's mounted for real). Expected: no switcher/refresh, date control present, no console errors. Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add src/components/creativeos/CreativeOSTopbar.tsx
git commit -m "feat(creativeos): topbar share mode (no switcher/refresh)"
```

---

## Task 9: Share dialog + Share button on the internal page

**Files:**
- Create: `src/components/creativeos/ShareLinkDialog.tsx`
- Modify: `src/components/creativeos/PageHeader.tsx`
- Modify: `src/pages/CreativeOS.tsx`

- [ ] **Step 1: Add `onShare` to `PageHeader`**

Extend `PageHeaderProps` with `onShare?: () => void;`. In the **client** (pink) header branch only, render a small "Share" button (use an existing lucide icon, e.g. `Share2`, matching the project's button styling) that calls `onShare`. Render it only when `onShare` is provided. Do not add it to the portfolio header.

- [ ] **Step 2: Implement `ShareLinkDialog.tsx`**

A controlled shadcn `Dialog` (`open`, `onOpenChange`). Props: `{ open, onOpenChange, customerId, clientName }`. Behavior:
- On open (e.g. a `useEffect` keyed on `open && customerId`), call `getOrCreateShareLink({ customerId, clientName }, { userId })` where `userId` comes from `useAuth()` (`session.user.id`). Store the row in state; show a spinner while loading and an error message on failure.
- Show `shareUrl(row.token)` in a read-only input with a **Copy** button (`navigator.clipboard.writeText`, with a "Copied" confirmation).
- **Revoke** button → `setRevoked(customerId, true)` then refresh state; when `row.revoked`, show a "Link revoked" state and swap the button to **Re-enable** (`setRevoked(customerId, false)`).
- **Regenerate** button → confirm, then `regenerateShareLink(customerId)`; update the displayed URL.
- Use TanStack Query mutations or local `useState` + async handlers — match whatever pattern the codebase already uses for writes (check `report-history.ts` usage). Keep all Supabase calls in the Task 6 module; the dialog only orchestrates.

- [ ] **Step 3: Wire into `CreativeOS.tsx`**

- Add `const [shareOpen, setShareOpen] = useState(false);`.
- Pass `onShare={() => setShareOpen(true)}` to `PageHeader` only when `selectedId` is set.
- Render `<ShareLinkDialog open={shareOpen} onOpenChange={setShareOpen} customerId={selectedId!} clientName={…resolved name…} />` (reuse the same name resolution already computed for `selectedClient`).

- [ ] **Step 4: Manual check**

Run: `npm run dev:all` (needs server env). Sign in, open a client deep dive, click Share → a link appears; Copy works; Revoke flips state; Regenerate changes the URL. Expected: all four behaviors work; no console errors. Stop the servers.

- [ ] **Step 5: Commit**

```bash
git add src/components/creativeos/ShareLinkDialog.tsx src/components/creativeos/PageHeader.tsx src/pages/CreativeOS.tsx
git commit -m "feat(creativeos): share-link manage dialog + Share button"
```

---

## Task 10: Public `ClientShareView` page + route

**Files:**
- Create: `src/pages/ClientShareView.tsx`
- Create: `src/pages/ClientShareView.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add the public route**

In `src/App.tsx`, add **outside** any `ProtectedRoute` (mirror the existing `/shared/:id` public route):

```tsx
<Route path="/c/:token" element={<ClientShareView />} />
```

Import `ClientShareView` at the top.

- [ ] **Step 2: Implement `ClientShareView.tsx`**

Structure (reusing existing pieces; mirror the layout shell of `CreativeOS.tsx`):

```tsx
import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import "@/components/creativeos/creativeos.css";
import { CreativeOSTopbar } from "@/components/creativeos/CreativeOSTopbar";
import { CreativeOSSidebar, subsFor, type TabId } from "@/components/creativeos/CreativeOSSidebar";
import { PageHeader } from "@/components/creativeos/PageHeader";
import { CreativeOSFilterBar, type StatusFilter } from "@/components/creativeos/CreativeOSFilterBar";
import { CreativeDrawer } from "@/components/creativeos/CreativeDrawer";
import { LoadingState, ErrorState, EmptyState } from "@/components/creativeos/states";
import { CreativeLab } from "@/components/creativeos/tabs/CreativeLab";
import { HookRetention } from "@/components/creativeos/tabs/HookRetention";
import { Trendlines } from "@/components/creativeos/tabs/Trendlines";
import { WinningVault } from "@/components/creativeos/tabs/WinningVault";
import { useMemoizedRangeLabel } from "@/components/creativeos/useRangeLabel";
import { defaultRange } from "@/lib/creativeos";
import type { Creative, ClientResponse, DateRange } from "@/lib/creativeos-types";

const SHARE_TABS: TabId[] = ["lab", "hook", "trend", "vault"];

async function fetchShare(token: string, range: DateRange): Promise<ClientResponse> {
  const u = new URL(`/api/share/${token}`, window.location.origin);
  u.searchParams.set("start", range.start);
  u.searchParams.set("end", range.end);
  const res = await fetch(u);
  if (res.status === 404 || res.status === 403) {
    const e = new Error("inactive") as Error & { inactive?: boolean };
    e.inactive = true;
    throw e;
  }
  if (!res.ok) throw new Error(`Share data failed: ${res.status}`);
  return res.json();
}

export default function ClientShareView() {
  const { token = "" } = useParams();
  const [tab, setTab] = useState<TabId>("lab");
  const [sub, setSub] = useState<string>(subsFor("lab")[0]);
  const [range, setRange] = useState<DateRange>(() => defaultRange());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [drawerCreative, setDrawerCreative] = useState<Creative | null>(null);
  const rangeLabel = useMemoizedRangeLabel(range);

  const q = useQuery({
    queryKey: ["share", token, range],
    queryFn: () => fetchShare(token, range),
    retry: (count, err) => !(err as { inactive?: boolean })?.inactive && count < 2,
  });

  const goTab = (t: TabId) => { setTab(t); setSub(subsFor(t)[0]); };
  const openCreative = (c: Creative) => setDrawerCreative(c);
  const showFilterBar = tab === "lab" && sub === "Leaderboard";

  const renderContent = () => {
    if (q.isLoading) return <LoadingState />;
    if ((q.error as { inactive?: boolean })?.inactive)
      return <EmptyState title="This link is no longer active" hint="Ask your Ad-Lab contact for a new link." />;
    if (q.isError) return <ErrorState message={(q.error as Error)?.message ?? "Unknown error"} onRetry={() => q.refetch()} />;
    if (!q.data) return null;
    if (tab === "lab") return <CreativeLab data={q.data} sub={sub} statusFilter={statusFilter} search={search} onOpenCreative={openCreative} />;
    if (tab === "hook") return <HookRetention data={q.data} sub={sub} onOpenCreative={openCreative} />;
    if (tab === "trend") return <Trendlines data={q.data} sub={sub} />;
    if (tab === "vault") return <WinningVault data={q.data} onOpenCreative={openCreative} />;
    return null;
  };

  return (
    <div className="cos-root h-screen flex flex-col">
      <CreativeOSTopbar
        shareMode
        clients={[]}
        clientLabel={q.data?.account.name}
        selectedId={null}
        onSelectClient={() => {}}
        range={range}
        onRange={setRange}
        rangeLabel={rangeLabel}
        onRefresh={() => q.refetch()}
        isFetching={q.isFetching}
      />
      <div className="flex-1 flex min-h-0">
        <CreativeOSSidebar tab={tab} onTab={goTab} hasClient tabs={SHARE_TABS} />
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <PageHeader
            tabTitle=""
            window={range}
            subs={subsFor(tab)}
            activeSub={sub}
            onSub={setSub}
            selectedClient={q.data?.account ?? null}
          />
          {showFilterBar && (
            <CreativeOSFilterBar statusFilter={statusFilter} onStatusFilter={setStatusFilter} search={search} onSearch={setSearch} />
          )}
          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
            <div className="max-w-[1440px] mx-auto">{renderContent()}</div>
          </div>
        </main>
      </div>
      <CreativeDrawer creative={drawerCreative} onClose={() => setDrawerCreative(null)} />
    </div>
  );
}
```

Adjust prop names if Step 8/earlier components differ. The `selectedClient` prop expects `ClientResponse["account"]`, which `q.data.account` satisfies — so the pink client header renders without the Share button (no `onShare` passed). No "Back to portfolio" / "Insight Engine" links are rendered here.

- [ ] **Step 3: Write the failing test**

`src/pages/ClientShareView.test.tsx` — render with mocked fetch + a QueryClientProvider + MemoryRouter at `/c/tok`. Two cases:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ClientShareView from "./ClientShareView";

function renderAt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/c/tok"]}>
        <Routes><Route path="/c/:token" element={<ClientShareView />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ClientShareView", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows an inactive message on 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status: 404, ok: false }));
    renderAt();
    await waitFor(() => expect(screen.getByText(/no longer active/i)).toBeTruthy());
  });

  it("renders the deep dive without Command Center or a client switcher", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ account: { name: "Acme", customerId: "123" }, creatives: [], /* + any required ClientResponse fields */ }),
    }));
    renderAt();
    await waitFor(() => expect(screen.getByText("Acme")).toBeTruthy());
    expect(screen.queryByText("Command Center")).toBeNull();
  });
});
```

Note: fill the mocked `json()` payload with the minimal valid `ClientResponse` shape so the tab components render without throwing. Per `src/lib/creativeos-types.ts`, that means including `window`, `account: { customerId, name }`, `benchmarks` (e.g. `{ viewRate, hook, cpv }`), `creatives: []`, and `daily: []` — `Trendlines`/`HookRetention` read `data.daily`/`data.benchmarks`. Verify the exact `benchmarks` keys against the type before finalizing. If a full payload is heavy, assert only on the chrome (topbar name present, "Command Center" absent) and keep the content area tolerant.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/pages/ClientShareView.test.tsx`
Expected: both PASS (iterate on the mocked payload until the render is stable).

- [ ] **Step 5: Manual end-to-end check**

Run: `npm run dev:all` (with server env). Create a link for a client (Task 9 dialog), open it in a **logged-out** browser/incognito at `/c/<token>`:
- See only that client's data, the lab/hook/trend/vault tabs, no switcher, no Command Center.
- Change the date range → data re-fetches.
- Revoke the link in the dashboard → reload the share page → "This link is no longer active".
- Regenerate → old URL stays inactive, new URL works.
Expected: all behaviors as described.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ClientShareView.tsx src/pages/ClientShareView.test.tsx src/App.tsx
git commit -m "feat(creativeos): public client share view at /c/:token"
```

---

## Final verification

- [ ] **Run the whole suite:** `npm run test` → all green.
- [ ] **Typecheck/lint:** `npm run lint` → clean (fix any new issues).
- [ ] **Build:** `npm run build` → succeeds.
- [ ] **Security sanity check:** confirm `WEBHOOK_KEY`/`SUPABASE_SERVICE_ROLE_KEY` are read only via `process.env` in `server.js`/`server/` and never imported into anything under `src/` (they must not be bundled). Run: `grep -rn "SERVICE_ROLE\|WEBHOOK_KEY" src/` → expect **no matches**.
- [ ] **Confirm the spec's security guarantee:** tampering the token or any query param cannot return another client's data (only the bound `customer_id` is ever queried; verified by Task 3 tests + manual check).
