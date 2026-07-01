import { describe, it, expect, vi } from "vitest";
import { resolveTranscript } from "./transcript.mjs";

function fakeSupabase(row: unknown, onUpsert?: (p: unknown) => void) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: row, error: null }),
    upsert: (payload: unknown) => {
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
    const upserts: unknown[] = [];
    const getSubtitles = vi.fn().mockResolvedValue({ lang: "en", segments: SEGS });
    const res = await resolveTranscript(
      { videoId: "abcdefghijk" },
      { supabase: fakeSupabase(null, (p) => upserts.push(p)), getSubtitles },
    );
    expect(res.body).toEqual({ available: true, lang: "en", segments: SEGS });
    expect(upserts[0]).toMatchObject({ video_id: "abcdefghijk", status: "ok", segments: SEGS });
  });

  it("caches unavailable when no captions or scraper throws", async () => {
    const upserts: unknown[] = [];
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
