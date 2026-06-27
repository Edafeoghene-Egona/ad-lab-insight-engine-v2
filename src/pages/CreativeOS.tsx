import { useMemoizedRangeLabel } from "@/components/creativeos/useRangeLabel";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "@/components/creativeos/creativeos.css";
import { CreativeOSTopbar } from "@/components/creativeos/CreativeOSTopbar";
import { CreativeOSSidebar, TABS, subsFor, type TabId } from "@/components/creativeos/CreativeOSSidebar";
import { PageHeader } from "@/components/creativeos/PageHeader";
import { CreativeOSFilterBar, type StatusFilter } from "@/components/creativeos/CreativeOSFilterBar";
import { CreativeDrawer } from "@/components/creativeos/CreativeDrawer";
import { ShareLinkDialog } from "@/components/creativeos/ShareLinkDialog";
import { LoadingState, ErrorState, EmptyState } from "@/components/creativeos/states";
import { CommandCenter } from "@/components/creativeos/tabs/CommandCenter";
import { CreativeLab } from "@/components/creativeos/tabs/CreativeLab";
import { HookRetention } from "@/components/creativeos/tabs/HookRetention";
import { Trendlines } from "@/components/creativeos/tabs/Trendlines";
import { WinningVault } from "@/components/creativeos/tabs/WinningVault";
import { defaultRange, fetchClient, fetchPortfolio } from "@/lib/creativeos";
import type { Creative, DateRange } from "@/lib/creativeos-types";

const CreativeOS = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("command");
  const [sub, setSub] = useState<string>("Portfolio");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>(() => defaultRange());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [drawerCreative, setDrawerCreative] = useState<Creative | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  const rangeLabel = useMemoizedRangeLabel(range);

  const portfolio = useQuery({
    queryKey: ["creativeos", "portfolio", range],
    queryFn: () => fetchPortfolio(range),
  });

  const client = useQuery({
    queryKey: ["creativeos", "client", selectedId, range],
    queryFn: () => fetchClient(selectedId!, range),
    enabled: !!selectedId,
  });

  const goTab = (t: TabId) => {
    if (TABS.find((x) => x.id === t)?.clientOnly && !selectedId) return;
    setTab(t);
    setSub(subsFor(t)[0]);
  };

  const selectClient = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      setTab("lab");
      setSub(subsFor("lab")[0]);
    } else {
      setTab("command");
      setSub(subsFor("command")[0]);
    }
  };

  const tabTitle = TABS.find((t) => t.id === tab)?.label ?? "Command Center";
  const onPortfolio = tab === "command" || !selectedId;
  const activeQuery = onPortfolio ? portfolio : client;
  const isFetching = portfolio.isFetching || client.isFetching;
  const clientsForSwitcher = portfolio.data?.clients ?? [];
  const openCreative = (c: Creative) => setDrawerCreative(c);
  // Prefer the portfolio-known name; the client pull returns only the raw id.
  const selectedName = selectedId
    ? clientsForSwitcher.find((c) => c.customerId === selectedId)?.name ?? client.data?.account.name ?? selectedId
    : "";

  const renderContent = () => {
    if (onPortfolio) {
      if (portfolio.isLoading) return <LoadingState />;
      if (portfolio.isError)
        return <ErrorState message={(portfolio.error as Error)?.message ?? "Unknown error"} onRetry={() => portfolio.refetch()} />;
      if (!portfolio.data) return null;
      if (!portfolio.data.clients.length)
        return <EmptyState title="No active video / Demand Gen clients in this window" hint="Try widening the date range." />;
      return <CommandCenter data={portfolio.data} sub={sub} onSelectClient={selectClient} />;
    }
    if (client.isLoading) return <LoadingState />;
    if (client.isError)
      return <ErrorState message={(client.error as Error)?.message ?? "Unknown error"} onRetry={() => client.refetch()} />;
    if (!client.data) return null;
    if (tab === "lab")
      return <CreativeLab data={client.data} sub={sub} statusFilter={statusFilter} search={search} onOpenCreative={openCreative} />;
    if (tab === "hook") return <HookRetention data={client.data} sub={sub} onOpenCreative={openCreative} />;
    if (tab === "trend") return <Trendlines data={client.data} sub={sub} />;
    if (tab === "vault") return <WinningVault data={client.data} onOpenCreative={openCreative} />;
    return null;
  };

  // Filter bar only matters on the Lab → Leaderboard view.
  const showFilterBar = !onPortfolio && tab === "lab" && sub === "Leaderboard";

  return (
    <div className="cos-root h-screen flex flex-col">
      <CreativeOSTopbar
        clients={clientsForSwitcher}
        selectedId={selectedId}
        onSelectClient={selectClient}
        range={range}
        onRange={setRange}
        rangeLabel={rangeLabel}
        onRefresh={() => activeQuery.refetch()}
        isFetching={isFetching}
      />
      <div className="flex-1 flex min-h-0">
        <CreativeOSSidebar tab={tab} onTab={goTab} hasClient={!!selectedId} />
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <PageHeader
            tabTitle={tabTitle}
            window={range}
            subs={subsFor(tab)}
            activeSub={sub}
            onSub={setSub}
            selectedClient={selectedId ? { customerId: selectedId, name: selectedName } : null}
            onShare={selectedId ? () => setShareOpen(true) : undefined}
          />
          {showFilterBar && (
            <CreativeOSFilterBar
              statusFilter={statusFilter}
              onStatusFilter={setStatusFilter}
              search={search}
              onSearch={setSearch}
            />
          )}
          {selectedId && (
            <div className="px-6 lg:px-8 pt-3">
              <button
                type="button"
                onClick={() => selectClient(null)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to portfolio
              </button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto px-6 lg:px-8 py-6">
            <div className="max-w-[1440px] mx-auto">{renderContent()}</div>
          </div>
        </main>
      </div>

      <CreativeDrawer creative={drawerCreative} onClose={() => setDrawerCreative(null)} />

      {selectedId && (
        <ShareLinkDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          customerId={selectedId}
          clientName={selectedName}
        />
      )}

      <button
        type="button"
        onClick={() => navigate("/")}
        className="fixed bottom-4 left-4 z-50 text-[11px] text-slate-400 hover:text-slate-600 bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5"
      >
        ← Insight Engine
      </button>
    </div>
  );
};

export default CreativeOS;
