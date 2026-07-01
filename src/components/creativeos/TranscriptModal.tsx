import { useQuery } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CosButton } from "./CosButton";

interface Segment {
  start: number;
  dur: number;
  text: string;
}
interface TranscriptResponse {
  available: boolean;
  lang?: string;
  segments?: Segment[];
}

const fmtTs = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

async function fetchTranscript(videoId: string): Promise<TranscriptResponse> {
  const res = await fetch(`/api/transcript/${videoId}`);
  if (!res.ok) throw new Error(`Transcript failed: ${res.status}`);
  return res.json();
}

interface TranscriptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoId: string;
  title: string;
}

export function TranscriptModal({ open, onOpenChange, videoId, title }: TranscriptModalProps) {
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
      {/* z-[70] on BOTH overlay and content so the modal layers above the creative drawer (z-[60]). */}
      <DialogContent overlayClassName="z-[70]" className="z-[70] sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Transcript · {title}</DialogTitle>
        </DialogHeader>

        {q.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading transcript…
          </div>
        ) : q.isError ? (
          <p className="text-sm text-red-600 py-6">Couldn’t load the transcript. Please try again.</p>
        ) : !q.data?.available || segments.length === 0 ? (
          <p className="text-sm text-slate-500 py-6">Transcript not available for this video.</p>
        ) : (
          <>
            <div className="flex justify-end">
              <CosButton variant="outline" size="sm" onClick={copyAll}>
                <Copy className="w-3.5 h-3.5" /> Copy all
              </CosButton>
            </div>
            <div className="mt-2 overflow-y-auto flex flex-col gap-1 pr-1">
              {segments.map((s, i) => (
                <div key={i} className="flex gap-3 text-sm">
                  <a
                    href={`https://www.youtube.com/watch?v=${videoId}&t=${Math.floor(s.start)}s`}
                    target="_blank"
                    rel="noopener noreferrer"
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
