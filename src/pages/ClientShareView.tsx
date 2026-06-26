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

type InactiveError = Error & { inactive?: boolean };

async function fetchShare(token: string, range: DateRange): Promise<ClientResponse> {
  const u = new URL(`/api/share/${token}`, window.location.origin);
  u.searchParams.set("start", range.start);
  u.searchParams.set("end", range.end);
  const res = await fetch(u);
  if (res.status === 404 || res.status === 403) {
    const e = new Error("inactive") as InactiveError;
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
    retry: (count, err) => !(err as InactiveError)?.inactive && count < 2,
  });

  const goTab = (t: TabId) => {
    setTab(t);
    setSub(subsFor(t)[0]);
  };
  const openCreative = (c: Creative) => setDrawerCreative(c);
  const showFilterBar = tab === "lab" && sub === "Leaderboard";

  const renderContent = () => {
    if (q.isLoading) return <LoadingState />;
    if ((q.error as InactiveError)?.inactive)
      return <EmptyState title="This link is no longer active" hint="Ask your Ad-Lab contact for a new link." />;
    if (q.isError)
      return <ErrorState message={(q.error as Error)?.message ?? "Unknown error"} onRetry={() => q.refetch()} />;
    if (!q.data) return null;
    if (tab === "lab")
      return <CreativeLab data={q.data} sub={sub} statusFilter={statusFilter} search={search} onOpenCreative={openCreative} />;
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
            <CreativeOSFilterBar
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              search={search}
              onSearch={setSearch}
            />
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
