import { statusLabel } from "@/lib/creativeos";
import type { CreativeStatus } from "@/lib/creativeos-types";
import { cn } from "@/lib/utils";

const STYLES: Record<"win" | "test" | "loss" | "none", string> = {
  win: "bg-emerald-100 text-emerald-800 border border-emerald-200",
  test: "bg-violet-100 text-violet-800 border border-violet-200",
  loss: "bg-rose-100 text-rose-800 border border-rose-200",
  none: "bg-slate-100 text-slate-500 border border-slate-200",
};

/** WIN / TEST / RETIRE pill, driven by the Google Ads label. */
export function StatusBadge({ status, className }: { status: CreativeStatus; className?: string }) {
  const key = status ?? "none";
  return <span className={cn("cos-badge", STYLES[key], className)}>{statusLabel(status)}</span>;
}
