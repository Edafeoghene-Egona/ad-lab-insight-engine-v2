# Creative Video Transcripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "View transcript" button to the creative drawer that opens a modal showing the YouTube video's captions as timestamped, clickable lines — in both the internal dashboard and the public share view.

**Architecture:** A CORS-safe server proxy `GET /api/transcript/:videoId` (Express) scrapes YouTube captions via a pinned library wrapped behind `getSubtitles`, caches results (including negatives) in a Supabase `video_transcripts` table via the service-role client, and returns normalized `{available, lang, segments}`. A `TranscriptModal` (shadcn Dialog) fetches that endpoint with React Query and renders timestamped lines; the drawer owns its open state.

**Tech Stack:** Vite + React SPA, TanStack Query, shadcn/ui Dialog, Express (`server.js`), Supabase (service-role), `youtube-transcript@1.3.1`, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-06-27-creative-transcripts-design.md`

---

## File Structure

**New**
- `supabase/migrations/<ts>_video_transcripts.sql` — cache table + RLS.
- `server/transcript.mjs` — pure `resolveTranscript({videoId},{supabase,getSubtitles})`.
- `server/transcript.test.ts` — unit tests for the resolver.
- `server/youtube-captions.mjs` — `getSubtitles(videoId)` real wrapper around `youtube-transcript` (network; not unit-tested).
- `src/components/creativeos/TranscriptModal.tsx` (+ `.test.tsx`).

**Modified**
- `server.js` — add the route + import `getSubtitles`/`resolveTranscript`.
- `src/components/creativeos/CreativeDrawer.tsx` (+ new `.test.tsx`) — button + modal state.
- `src/integrations/supabase/types.ts` — add `video_transcripts` (hand-edited; no type-gen script here — intentional, same as `client_share_links`).
- `src/components/ui/dialog.tsx` — add an optional `overlayClassName` passthrough to `DialogContent` (additive; default behavior unchanged) so the transcript modal can raise its overlay above the drawer.
- `package.json` / `package-lock.json` — add `youtube-transcript@1.3.1`.

**Conventions:** ESM everywhere (`server.js` uses `import`; the proxy modules are `.mjs` so raw Node runs them). Mirror the tested `server/share-proxy.mjs` dependency-injection pattern. Use `CosButton` + the type scale on the frontend. vitest `include` already covers `server/**`.

---

## Task 1: Supabase migration — `video_transcripts`

**Files:** Create `supabase/migrations/<ts>_video_transcripts.sql`; Modify `src/integrations/supabase/types.ts`

- [ ] **Step 1: Inspect the newest migration for conventions**

Run: `ls supabase/migrations && cat "supabase/migrations/$(ls supabase/migrations | tail -1)"`
Expected: confirm uppercase-SQL style + timestamp format (e.g. `20260627HHMMSS_video_transcripts.sql`).

- [ ] **Step 2: Write the migration**

```sql
-- video_transcripts: cache of scraped YouTube captions, keyed by video id.
-- Read/written only by the server-side service-role proxy; never by the browser.
CREATE TABLE public.video_transcripts (
    video_id TEXT PRIMARY KEY,
    lang TEXT,
    segments JSONB,                       -- [{ start:number(s), dur:number(s), text:string }]
    status TEXT NOT NULL DEFAULT 'ok',    -- 'ok' | 'unavailable'
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.video_transcripts ENABLE ROW LEVEL SECURITY;
-- No anon/public policy: only the service-role key (which bypasses RLS) touches this.
```

- [ ] **Step 3: Apply to the linked project**

Run: `npx supabase db push` (or apply via the Supabase dashboard SQL editor if the CLI isn't authenticated — do not block on it).
Expected: table `video_transcripts` exists.

- [ ] **Step 4: Add the table to generated types**

In `src/integrations/supabase/types.ts`, inside `Database.public.Tables`, add (mirroring the existing `client_share_links` block):

```ts
      video_transcripts: {
        Row: { video_id: string; lang: string | null; segments: Json | null; status: string; fetched_at: string }
        Insert: { video_id: string; lang?: string | null; segments?: Json | null; status?: string; fetched_at?: string }
        Update: { video_id?: string; lang?: string | null; segments?: Json | null; status?: string; fetched_at?: string }
      }
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations src/integrations/supabase/types.ts
git commit -m "feat(creativeos): add video_transcripts cache table + RLS"
```

---

## Task 2: `resolveTranscript` resolver (TDD)

Pure, dependency-injected — no network/DB in the test.

**Files:** Create `server/transcript.mjs`, `server/transcript.test.ts`

- [ ] **Step 1: Write the failing test** — `server/transcript.test.ts`

```ts
import { describe, it, expect, vi } from "vitest";
import { resolveTranscript } from "./transcript.mjs";

function fakeSupabase(row, onUpsert) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
    upsert: (payload) => {
      onUpsert?.(payload);
      return Promise.resolve({ error: null });
    },
  };
  return { from: () => chain };
}
const SEGS = [{ start: 0, dur: 2, text: "hi" }];

describe("resolveTranscript", () => {
  it("rejects a malformed videoId with 400", async () => {
    const res = await resolveTranscript({ videoId: "nope" }, { supabase: fakeSupabase(null), getSubtitles: vi.fn() });
    expect(res.status).toBe(400);
  });

  it("returns cached segments on an 'ok' row without scraping", async () => {
    const getSubtitles = vi.fn();
    const res = await resolveTranscript(
      { videoId: "abcdefghijk" },
      { supabase: fakeSupabase({ status: "ok", lang: "en", segments: SEGS }), getSubtitles },
    );
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ available: true, lang: "en", segments: SEGS });
    expect(getSubtitles).not.toHaveBeenCalled();
  });

  it("returns available:false on a cached 'unavailable' row", async () => {
    const res = await resolveTranscript(
      { videoId: "abcdefghijk" },
      { supabase: fakeSupabase({ status: "unavailable" }), getSubtitles: vi.fn() },
    );
    expect(res.body).toEqual({ available: false });
  });

  it("scrapes + caches on a miss when captions exist", async () => {
    const upserts = [];
    const getSubtitles = vi.fn().mockResolvedValue({ lang: "en", segments: SEGS });
    const res = await resolveTranscript(
      { videoId: "abcdefghijk" },
      { supabase: fakeSupabase(null, (p) => upserts.push(p)), getSubtitles },
    );
    expect(res.body).toEqual({ available: true, lang: "en", segments: SEGS });
    expect(upserts[0]).toMatchObject({ video_id: "abcdefghijk", status: "ok", segments: SEGS });
  });

  it("caches unavailable when no captions / scraper throws", async () => {
    const upserts = [];
    const res1 = await resolveTranscript(
      { videoId: "abcdefghijk" },
      { supabase: fakeSupabase(null, (p) => upserts.push(p)), getSubtitles: vi.fn().mockResolvedValue({ lang: null, segments: [] }) },
    );
    expect(res1.body).toEqual({ available: false });
    expect(upserts[0]).toMatchObject({ video_id: "abcdefghijk", status: "unavailable" });

    const res2 = await resolveTranscript(
      { videoId: "abcdefghijk" },
      { supabase: fakeSupabase(null, () => {}), getSubtitles: vi.fn().mockRejectedValue(new Error("blocked")) },
    );
    expect(res2.body).toEqual({ available: false });
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing)

Run: `npx vitest run server/transcript.test.ts`

- [ ] **Step 3: Implement `server/transcript.mjs`**

```js
// Pure transcript resolution: cache-first, scrape-on-miss, negative-cache.
// No network or env here — supabase + getSubtitles are injected (see share-proxy.mjs).

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * @param {{videoId:string}} params
 * @param {{supabase:any, getSubtitles:(id:string)=>Promise<{lang:string|null,segments:{start:number,dur:number,text:string}[]}>}} deps
 * @returns {Promise<{status:number, body:any}>}
 */
export async function resolveTranscript({ videoId }, { supabase, getSubtitles }) {
  if (!VIDEO_ID.test(videoId ?? "")) return { status: 400, body: { error: "invalid videoId" } };

  const { data: row, error } = await supabase
    .from("video_transcripts")
    .select("video_id, lang, segments, status")
    .eq("video_id", videoId)
    .maybeSingle();
  if (error) return { status: 500, body: { error: "cache read failed" } };

  if (row) {
    return row.status === "ok"
      ? { status: 200, body: { available: true, lang: row.lang, segments: row.segments } }
      : { status: 200, body: { available: false } };
  }

  let lang = null;
  let segments = [];
  try {
    ({ lang, segments } = await getSubtitles(videoId));
  } catch {
    segments = [];
  }

  if (segments && segments.length) {
    await supabase.from("video_transcripts").upsert({ video_id: videoId, lang, segments, status: "ok" });
    return { status: 200, body: { available: true, lang, segments } };
  }
  await supabase.from("video_transcripts").upsert({ video_id: videoId, status: "unavailable" });
  return { status: 200, body: { available: false } };
}
```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run server/transcript.test.ts`)

- [ ] **Step 5: Commit**

```bash
git add server/transcript.mjs server/transcript.test.ts
git commit -m "feat(creativeos): add transcript resolver (cache-first, negative-cache) with tests"
```

---

## Task 3: Caption scraper wrapper + Express route

**Files:** Create `server/youtube-captions.mjs`; Modify `server.js`

- [ ] **Step 1: Install the pinned library**

Run: `npm install youtube-transcript@1.3.1`

- [ ] **Step 2: Implement the wrapper** — `server/youtube-captions.mjs`

```js
import { YoutubeTranscript } from "youtube-transcript";

// youtube-transcript returns [{ text, duration, offset, lang }]. UNIT CAVEAT: offset/
// duration are milliseconds in v1.3.x. Verified in Step 3 — adjust MS_TO_S if wrong.
const MS_TO_S = 1000;

/** Fetch the default caption track for a video, normalized to seconds. */
export async function getSubtitles(videoId) {
  const raw = await YoutubeTranscript.fetchTranscript(videoId); // throws if captions disabled
  const segments = (raw ?? []).map((r) => ({
    start: r.offset / MS_TO_S,
    dur: r.duration / MS_TO_S,
    text: r.text,
  }));
  return { lang: raw?.[0]?.lang ?? null, segments };
}
```

- [ ] **Step 3: VERIFY the time units empirically** (do not skip — library versions differ)

Run:
```bash
node -e "import('youtube-transcript').then(async m => { const t = await m.YoutubeTranscript.fetchTranscript('GdQ4ipkz1hY'); console.log(t.slice(0,3)); })"
```
Expected: 2–3 segments. **Inspect `offset`/`duration`:** if values look like `0, 2400, 5100` (ms) keep `MS_TO_S = 1000`; if they look like `0, 2.4, 5.1` (s) set `MS_TO_S = 1`. (`GdQ4ipkz1hY` is a real client creative id; swap for any captioned video if it lacks captions.) If the call throws (captions disabled / blocked from this network), note it and rely on the resolver's unavailable path — but still set the divisor correctly by testing any captioned public video.

- [ ] **Step 4: Wire the route into `server.js`**

Add near the other imports:
```js
import { resolveTranscript } from './server/transcript.mjs';
import { getSubtitles } from './server/youtube-captions.mjs';
```
Add the route immediately after the `/api/share/:token` handler (before the SPA catch-all). Note this returns a JSON body on every status (unlike the share route's `sendStatus`):
```js
app.get('/api/transcript/:videoId', async (req, res) => {
  try {
    const result = await resolveTranscript(
      { videoId: req.params.videoId },
      { supabase: supabaseAdmin, getSubtitles },
    );
    res.status(result.status).json(result.body);
  } catch (err) {
    console.error('transcript error', err);
    res.status(500).json({ error: 'internal error' });
  }
});
```

- [ ] **Step 5: Smoke-test the endpoint**

Run:
```bash
npm run build && SUPABASE_URL=$SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY PORT=3998 node server.js &
sleep 1
curl -s -o /dev/null -w "bad id -> %{http_code}\n" localhost:3998/api/transcript/xxx     # expect 400
curl -s "localhost:3998/api/transcript/GdQ4ipkz1hY" | head -c 300; echo                   # expect {"available":...}
kill %1
```
Expected: `400` for the malformed id; a JSON `{available:...}` for the real id (may be `available:false` if that video has no captions or the network blocks scraping — both acceptable). If real Supabase env isn't available locally, note it and rely on Task 2 unit tests.

- [ ] **Step 6: Commit**

```bash
git add server.js server/youtube-captions.mjs package.json package-lock.json
git commit -m "feat(creativeos): serve /api/transcript/:videoId (youtube-transcript@1.3.1)"
```

---

## Task 4: `TranscriptModal` (TDD)

**Files:** Modify `src/components/ui/dialog.tsx`; Create `src/components/creativeos/TranscriptModal.tsx`, `.test.tsx`

> **Why the dialog tweak:** `CreativeDrawer` is `fixed … z-[60]`. shadcn's `DialogContent`
> renders its overlay internally at a hardcoded `z-50` and does NOT forward `className` to
> that overlay — so bumping only the content leaves the modal backdrop *behind* the drawer
> (drawer stays undimmed/clickable). We add an `overlayClassName` passthrough so both the
> overlay and content can be raised to `z-[70]`. (`DialogOverlay` composes its classes with
> `cn`/twMerge, so `z-[70]` cleanly overrides the base `z-50`.)

- [ ] **Step 0: Add `overlayClassName` passthrough to `DialogContent`** (`src/components/ui/dialog.tsx`)

Change the `DialogContent` signature + overlay render (leave everything else untouched):

```tsx
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { overlayClassName?: string }
>(({ className, overlayClassName, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className,
      )}
      {...props}
    >
      {children}
      {/* …existing DialogPrimitive.Close unchanged… */}
```

`overlayClassName` is optional and defaults to `undefined`, so every existing dialog renders exactly as before.

- [ ] **Step 1: Write the failing test** — `TranscriptModal.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TranscriptModal } from "./TranscriptModal";

function renderModal(available: boolean, segments: unknown[] = []) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ available, segments }) }));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TranscriptModal open onOpenChange={() => {}} videoId="abcdefghijk" title="Ad 1" />
    </QueryClientProvider>,
  );
}

describe("TranscriptModal", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("renders timestamped lines with YouTube deep links", async () => {
    renderModal(true, [{ start: 64, dur: 3, text: "Big hook line" }]);
    await waitFor(() => expect(screen.getByText("Big hook line")).toBeTruthy());
    expect(screen.getByText("1:04")).toBeTruthy();
    const link = screen.getByRole("link", { name: /1:04/ });
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=abcdefghijk&t=64s");
  });

  it("shows a friendly message when no transcript is available", async () => {
    renderModal(false);
    await waitFor(() => expect(screen.getByText(/not available/i)).toBeTruthy());
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`npx vitest run src/components/creativeos/TranscriptModal.test.tsx`)

- [ ] **Step 3: Implement `TranscriptModal.tsx`**

```tsx
import { useQuery } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CosButton } from "./CosButton";

interface Segment { start: number; dur: number; text: string }
interface TranscriptResponse { available: boolean; lang?: string; segments?: Segment[] }

const fmtTs = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

async function fetchTranscript(videoId: string): Promise<TranscriptResponse> {
  const res = await fetch(`/api/transcript/${videoId}`);
  if (!res.ok) throw new Error(`Transcript failed: ${res.status}`);
  return res.json();
}

export function TranscriptModal({
  open, onOpenChange, videoId, title,
}: { open: boolean; onOpenChange: (o: boolean) => void; videoId: string; title: string }) {
  const q = useQuery({
    queryKey: ["transcript", videoId],
    queryFn: () => fetchTranscript(videoId),
    enabled: open && !!videoId,
  });
  const segments = q.data?.segments ?? [];
  const copyAll = async () => {
    await navigator.clipboard.writeText(segments.map((s) => s.text).join(" "));
    toast.success("Transcript copied");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* z-[70] on BOTH overlay and content so the modal layers above the drawer (z-[60]). */}
      <DialogContent overlayClassName="z-[70]" className="z-[70] sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Transcript · {title}</DialogTitle>
        </DialogHeader>

        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-8"><Loader2 className="w-4 h-4 animate-spin" /> Loading transcript…</div>
        ) : q.isError ? (
          <p className="text-sm text-red-600 py-6">Couldn’t load the transcript. Please try again.</p>
        ) : !q.data?.available || segments.length === 0 ? (
          <p className="text-sm text-slate-500 py-6">Transcript not available for this video.</p>
        ) : (
          <>
            <div className="flex justify-end">
              <CosButton variant="outline" size="sm" onClick={copyAll}><Copy className="w-3.5 h-3.5" /> Copy all</CosButton>
            </div>
            <div className="mt-2 overflow-y-auto flex flex-col gap-1 pr-1">
              {segments.map((s, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <a
                    href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(s.start)}s`}
                    target="_blank" rel="noopener noreferrer"
                    className="shrink-0 tabular-nums text-indigo-600 font-semibold hover:underline"
                  >
                    {fmtTs(s.start)}
                  </a>
                  <span className="text-slate-700">{s.text}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/components/creativeos/TranscriptModal.tsx src/components/creativeos/TranscriptModal.test.tsx
git commit -m "feat(creativeos): TranscriptModal with timestamped deep-linked lines"
```

---

## Task 5: Wire into `CreativeDrawer` (TDD)

**Files:** Modify `src/components/creativeos/CreativeDrawer.tsx`; Create `CreativeDrawer.test.tsx`

- [ ] **Step 1: Write the failing test** — `CreativeDrawer.test.tsx`

```tsx
import type { ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CreativeDrawer } from "./CreativeDrawer";
import type { Creative } from "@/lib/creativeos-types";

const base: Creative = {
  videoId: "abcdefghijk", title: "Ad 1", format: "In-stream", durationSec: 30,
  impressions: 1000, views: 500, viewRate: 0.3, avgCpv: 0.02, cost: 100,
  conversions: 5, conversionsValue: 200, quartiles: null, status: "win",
};

function wrap(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("CreativeDrawer transcript entry point", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ available: false }) })));

  it("shows View transcript when the creative has a videoId", () => {
    wrap(<CreativeDrawer creative={base} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /view transcript/i })).toBeTruthy();
  });

  it("hides View transcript when there is no videoId", () => {
    wrap(<CreativeDrawer creative={{ ...base, videoId: null }} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: /view transcript/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

In `CreativeDrawer.tsx`:
1. Add imports: `import { useState } from "react";`, `import { CosButton } from "./CosButton";`, `import { TranscriptModal } from "./TranscriptModal";`, and add `FileText` to the existing lucide import.
2. **Before** the `if (!creative) return null;` early return (Rules of Hooks), add:
   ```tsx
   const [transcriptOpen, setTranscriptOpen] = useState(false);
   ```
3. Replace the existing Watch-on-YouTube block with a row that adds the transcript button, and render the modal:
   ```tsx
   {c.videoId && (
     <div className="mt-4 flex gap-2">
       <a
         href={watchUrl(c.videoId)}
         target="_blank" rel="noopener noreferrer"
         className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
       >
         <Youtube className="w-4 h-4" /> Watch on YouTube
       </a>
       <CosButton variant="outline" size="md" onClick={() => setTranscriptOpen(true)}>
         <FileText className="w-4 h-4" /> View transcript
       </CosButton>
     </div>
   )}
   {c.videoId && (
     <TranscriptModal open={transcriptOpen} onOpenChange={setTranscriptOpen} videoId={c.videoId} title={c.title} />
   )}
   ```

- [ ] **Step 4: Run — expect PASS** (`npx vitest run src/components/creativeos/CreativeDrawer.test.tsx`)

- [ ] **Step 5: Commit**

```bash
git add src/components/creativeos/CreativeDrawer.tsx src/components/creativeos/CreativeDrawer.test.tsx
git commit -m "feat(creativeos): View transcript button + modal in the creative drawer"
```

---

## Final verification

- [ ] **Full suite:** `npm run test` → all green.
- [ ] **Lint:** `npm run lint` → no new errors.
- [ ] **Build:** `npm run build` → succeeds.
- [ ] **Security:** `grep -rn "SERVICE_ROLE\|WEBHOOK_KEY" src/` → no matches (secrets stay server-side).
- [ ] **Manual E2E** (`npm run dev:all` with server env): open a client → creative drawer → **View transcript** → modal shows timestamped lines (or a clean "not available"); a timestamp opens the video at that moment; **Copy all** works; confirm the same in a logged-out `/c/:token` share view; confirm the modal layers above the drawer.
```
