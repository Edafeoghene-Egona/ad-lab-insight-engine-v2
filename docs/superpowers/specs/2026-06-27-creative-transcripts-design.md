# Creative Video Transcripts — Design

**Date:** 2026-06-27
**Status:** Approved (design), pending implementation plan
**Author:** Edafe (with Claude)

## Summary

Add a "View transcript" affordance to each YouTube creative. Opening it shows the
video's captions as timestamped, clickable lines in a modal. Available in both the
internal dashboard and the public client share view.

## Goals

- Per-creative transcript, launched from the existing creative detail drawer.
- Timestamped segments; each timestamp links to that moment on YouTube.
- Copy-all-as-text.
- Works in the internal dashboard and in client share links.
- Fetch once, cache — transcripts are static per video.

## Non-Goals (YAGNI)

- No speech-to-text fallback yet (captions only; STT can be added later if coverage
  is poor).
- No transcript search, editing, translation, or in-app video playback.
- No transcript affordance on every card/row — the drawer is the single entry point.
- No n8n workflow changes.

## Context (current architecture)

- Vite + React SPA; per-creative detail lives in `CreativeDrawer`
  (`src/components/creativeos/CreativeDrawer.tsx`), opened from cards/rows in both the
  internal page and the public `ClientShareView`.
- Creatives carry `videoId: string | null` (`src/lib/creativeos-types.ts`). Live data
  shows 100% videoId coverage in sampled clients.
- An Express server (`server.js`) already serves the SPA and hosts `/api/share/:token`
  using a **service-role Supabase client** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
  and shared helpers in `server/share-proxy.mjs`.
- Vite dev proxies `/api` → Express (`vite.config.ts`); `npm run dev:all` runs both.
- shadcn `Dialog` is available (`src/components/ui/dialog.tsx`).

## Key constraint

YouTube has **no official API to pull a transcript for a video you don't own** (these
are clients' videos). The chosen source is the public **timedtext** captions endpoint.
It is **CORS-blocked in the browser**, so fetching must be server-side. It is also an
**unofficial, changeable endpoint** and only works when the video actually has captions
— so "transcript not available" is an expected, gracefully-handled outcome.

## Architecture

```
CreativeDrawer  ── "View transcript" ──►  TranscriptModal (shadcn Dialog)
                                              │
                                              └─ GET /api/transcript/:videoId  (same-origin)
                                                    │  service-role Supabase
                                                    ├─ cache hit  → return cached segments
                                                    └─ miss → scrape captions → cache → return
                                              ◄─ { available, lang?, segments?: [{start,dur,text}] }
```

### Component 1 — Supabase table `video_transcripts`

New migration under `supabase/migrations/`.

| column | type | notes |
|---|---|---|
| `video_id` | text PK | YouTube 11-char id |
| `lang` | text, nullable | caption track language actually used |
| `segments` | jsonb, nullable | `[{ start:number (s), dur:number (s), text:string }]` |
| `status` | text | `ok` \| `unavailable` |
| `fetched_at` | timestamptz | default `now()` |

**RLS:** enabled, **no anon/public policy** — only the service-role proxy reads/writes
it (mirrors `client_share_links`). The browser never touches this table directly.
Negative results (`status = 'unavailable'`) are cached so videos without captions are
not re-scraped on every open.

### Component 2 — `resolveTranscript()` (server module)

New `server/transcript.mjs`, pure and dependency-injected (like `share-proxy.mjs`) so it
unit-tests without network or DB.

```
resolveTranscript({ videoId }, { supabase, getSubtitles })
  → validate videoId (^[A-Za-z0-9_-]{11}$); invalid → { status: 400 }
  → SELECT from video_transcripts WHERE video_id = videoId
      → row.status 'ok'          → { status: 200, body: { available:true, lang, segments } }
      → row.status 'unavailable' → { status: 200, body: { available:false } }
  → miss:
      → getSubtitles(videoId)  (English track preferred, else first)
          → segments found → upsert {status:'ok', lang, segments}; return available:true
          → none/throws     → upsert {status:'unavailable'};        return available:false
```

- `getSubtitles` wraps a maintained caption-scraper library (e.g. `youtube-transcript`)
  behind our own interface returning `{ start, dur, text }[]`, so the library can be
  swapped if YouTube breaks it. Scraper errors are treated as "unavailable", not 500.
- Normalizes library output to seconds for `start`/`dur`.

### Component 3 — Express route `GET /api/transcript/:videoId` (in `server.js`)

- Thin wrapper: calls `resolveTranscript({ videoId }, { supabase: supabaseAdmin,
  getSubtitles })`, maps `{status, body}` to the HTTP response.
- Placed before the SPA catch-all, alongside `/api/share/:token`.
- No secret required (timedtext is unauthenticated). Open endpoint — the `videoId` is
  already visible in the UI and the video is public on YouTube.

### Component 4 — `TranscriptModal` (frontend)

New `src/components/creativeos/TranscriptModal.tsx`, a controlled shadcn `Dialog`.
Props: `{ open, onOpenChange, videoId, title }`.

- On open, `useQuery(["transcript", videoId])` → `GET /api/transcript/:videoId`.
- States: loading; `available:false` → "Transcript not available for this video.";
  segments list on success.
- Each segment row: `[m:ss] text`, timestamp is an `<a>` to
  `https://www.youtube.com/watch?v=<videoId>&t=<Math.floor(start)>s` (new tab).
- **Copy all** button → `navigator.clipboard.writeText(segments.map(s => s.text).join(" "))`
  with a "Copied" confirmation (reuse the `sonner` toast pattern).
- Uses the CreativeOS button primitive (`CosButton`) and type scale for consistency.
- **Z-index:** `CreativeDrawer` is `z-[60]`; the transcript dialog's overlay + content
  are bumped to `z-[70]` so the modal layers above the open drawer.

### Component 5 — `CreativeDrawer` integration

- Add a "View transcript" `CosButton` (variant `outline`) next to the existing "Watch on
  YouTube" link, rendered **only when `c.videoId` is set**.
- The drawer owns `const [transcriptOpen, setTranscriptOpen] = useState(false)` and
  renders `<TranscriptModal open={transcriptOpen} onOpenChange={setTranscriptOpen}
  videoId={c.videoId} title={c.title} />`.
- Applies to both internal and share views automatically (both render `CreativeDrawer`).

## Data flow (request)

1. User opens a creative → drawer → clicks **View transcript**.
2. Modal calls `GET /api/transcript/:videoId`.
3. Express → `resolveTranscript` → Supabase cache or scrape → normalized segments.
4. Modal renders timestamped lines; timestamps deep-link into the YouTube video.

## Error handling

| Situation | Server | Modal |
|---|---|---|
| `videoId` null | (no button rendered) | — |
| Malformed id | `400` | generic error |
| No captions / scraper error | `200 { available:false }` (cached) | "Transcript not available for this video." |
| Cache/DB error | `500` | error with retry |
| Captions found | `200 { available:true, segments }` | timestamped lines |

## Testing strategy

- **Server `resolveTranscript` (vitest):** injected `getSubtitles` + fake Supabase —
  invalid id → 400; cache hit `ok` → segments; cache hit `unavailable` → available:false;
  miss + captions → upsert ok + available:true; miss + no captions/throw → upsert
  unavailable + available:false.
- **`TranscriptModal` (vitest + RTL):** mocked fetch — renders segments with correct
  `&t=` deep links; renders the not-available state; renders loading.
- **`CreativeDrawer` (vitest + RTL):** transcript button present only when `videoId` set;
  clicking opens the modal.

## Affected / new files

- New: `supabase/migrations/<ts>_video_transcripts.sql`
- New: `server/transcript.mjs` + `server/transcript.test.ts`
- New: `src/components/creativeos/TranscriptModal.tsx` (+ test)
- Edit: `server.js` (route + `getSubtitles` wiring)
- Edit: `src/components/creativeos/CreativeDrawer.tsx` (button + modal state) (+ test)
- Edit: `src/integrations/supabase/types.ts` (add `video_transcripts`)
- Dep: add a caption-scraper library (e.g. `youtube-transcript`)

## Open questions / assumptions

- Assumes the production host runs `server.js` (consistent with `npm start`) and has
  outbound network access to youtube.com for scraping.
- Assumes English-or-first-track is acceptable track selection; multi-language selection
  is out of scope.
- Auto-caption scraping is inherently fragile; if coverage proves poor, a speech-to-text
  fallback is the planned next step (explicitly deferred here).
