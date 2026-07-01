import { YoutubeTranscript } from "youtube-transcript";

// youtube-transcript@1.3.x returns [{ text, duration, offset, lang }] with offset/duration
// in MILLISECONDS (verified empirically). Normalize to seconds for the UI.
const MS_TO_S = 1000;

/** Fetch the default caption track for a video, normalized to seconds. Throws if captions are unavailable. */
export async function getSubtitles(videoId) {
  const raw = await YoutubeTranscript.fetchTranscript(videoId);
  const segments = (raw ?? []).map((r) => ({
    start: r.offset / MS_TO_S,
    dur: r.duration / MS_TO_S,
    text: r.text,
  }));
  return { lang: raw?.[0]?.lang ?? null, segments };
}
