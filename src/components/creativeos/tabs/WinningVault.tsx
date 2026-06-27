import { Trophy } from "lucide-react";
import { CreativeCard } from "../CreativeCard";
import { EmptyState } from "../states";
import type { ClientResponse, Creative } from "@/lib/creativeos-types";

/** All WIN creatives for the selected client, ranked by view rate. */
export function WinningVault({ data, onOpenCreative }: { data: ClientResponse; onOpenCreative: (c: Creative) => void }) {
  const winners = data.creatives
    .filter((c) => c.status === "win")
    .sort((a, b) => b.viewRate - a.viewRate);

  if (!winners.length) {
    return (
      <EmptyState
        title="No winners in this window"
        hint="Creatives labeled “Win” in Google Ads appear here. None are labeled win for this client in the selected range."
      />
    );
  }

  return (
    <div className="cos-reveal flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
          <Trophy className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <h2 className="cos-display text-xl font-semibold text-slate-900">Winning Vault</h2>
          <p className="text-xs text-slate-500">{winners.length} winning creative(s) · ranked by view rate</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {winners.map((c, i) => (
          <CreativeCard key={c.videoId ?? i} creative={c} rank={i + 1} onOpen={() => onOpenCreative(c)} />
        ))}
      </div>
    </div>
  );
}
