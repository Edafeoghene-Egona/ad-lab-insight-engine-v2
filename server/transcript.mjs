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
