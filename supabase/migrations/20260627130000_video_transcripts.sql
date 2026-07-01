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
