import { useMemoizedRangeLabel } from "@/components/creativeos/useRangeLabel";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "@/components/creativeos/creativeos.css";
import { CreativeOSTopbar } from "@/components/creativeos/CreativeOSTopbar";
import { CreativeOSSidebar, TABS, type TabId } from "@/components/creativeos/CreativeOSSidebar";
import { PageHeader } from "@/components/creativeos/PageHeader";
import { CreativeOSFilterBar, type StatusFilter } from "@/components/creativeos/CreativeOSFilterBar";
import { LoadingState, ErrorState, EmptyState } from "@/components/creativeos/states";
import { CommandCenter } from "@/components/creativeos/tabs/CommandCenter";
import { CreativeLab } from "@/components/creativeos/tabs/CreativeLab";
import { HookRetention } from "@/components/creativeos/tabs/HookRetention";
import { Trendlines } from "@/components/creativeos/tabs/Trendlines";
import { WinningVault } from "@/components/creativeos/tabs/WinningVault";
import { defaultRange, fetchClient, fetchPortfolio } from "@/lib/creativeos";
import type { DateRange } from "@/lib/creativeos-types";

const CreativeOS = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("command");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>(() => defaultRange());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

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

  const selectClient = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      // Drilling into a client: leave the portfolio-only Command Center.
      if (tab === "command") setTab("lab");
    } else {
      setTab("command");
    }
  };

  const onTab = (t: TabId) => {
    if (TABS.find((x) => x.id === t)?.clientOnly && !selectedId) return;
    setTab(t);
  };

  const tabTitle = TABS.find((t) => t.id === tab)?.label ?? "Command Center";
  const onPortfolio = tab === "command" || !selectedId;
  const activeQuery = onPortfolio ? portfolio : client;
  const isFetching = portfolio.isFetching || client.isFetching;

  const clientsForSwitcher = portfolio.data?.clients ?? [];

  const renderContent = () => {
    if (onPortfolio) {
      if (portfolio.isLoading) return <LoadingState />;
      if (portfolio.isError)
        return <ErrorState message={(portfolio.error as Error)?.message ?? "Unknown error"} onRetry={() => portfolio.refetch()} />;
      if (!portfolio.data) return null;
      if (!portfolio.data.clients.length)
        return <EmptyState title="No active video / Demand Gen clients in this window" hint="Try widening the date range." />;
      return <CommandCenter data={portfolio.data} onSelectClient={selectClient} />;
    }
    if (client.isLoading) return <LoadingState />;
    if (client.isError)
      return <ErrorState message={(client.error as Error)?.message ?? "Unknown error"} onRetry={() => client.refetch()} />;
    if (!client.data) return null;
    if (tab === "lab") return <CreativeLab data={client.data} statusFilter={statusFilter} search={search} />;
    if (tab === "hook") return <HookRetention data={client.data} />;
    if (tab === "trend") return <Trendlines data={client.data} />;
    if (tab === "vault") return <WinningVault data={client.data} />;
    return null;
  };

  const showFilterBar = !onPortfolio && tab === "lab";

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
        <CreativeOSSidebar tab={tab} onTab={onTab} hasClient={!!selectedId} />
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <PageHeader
            tabTitle={tabTitle}
            window={range}
            selectedClient={selectedId ? client.data?.account ?? { customerId: selectedId, name: clientsForSwitcher.find((c) => c.customerId === selectedId)?.name ?? selectedId } : null}
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
      <button
        onClick={() => navigate("/")}
        className="fixed bottom-4 left-4 z-50 text-[11px] text-slate-400 hover:text-slate-600 bg-white/80 border border-slate-200 rounded-lg px-3 py-1.5"
      >
        ← Insight Engine
      </button>
    </div>
  );
};

export default CreativeOS;
