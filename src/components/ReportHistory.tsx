import { useState } from "react";
import { ReportHistoryEntry, deleteReport } from "@/lib/report-history";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Clock, ExternalLink, Trash2, Loader2, AlertCircle,
  CheckCircle2, Bot, CalendarDays, X, Inbox
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { format, isToday, isYesterday, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";

interface ReportHistoryProps {
  history: ReportHistoryEntry[];
  automatedHistory: ReportHistoryEntry[];
  onView: (entry: ReportHistoryEntry) => void;
  onRefresh: () => Promise<void>;
}

type Preset = "today" | "yesterday" | "last7" | "custom" | null;

const statusBadge = (status: ReportHistoryEntry["status"]) => {
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
      <Loader2 className="w-3 h-3 animate-spin" />
      Processing
    </span>
  );
  if (status === "error") return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200/50">
      <AlertCircle className="w-3 h-3" />
      Failed
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/50">
      <CheckCircle2 className="w-3 h-3" />
      Complete
    </span>
  );
};

const ReportHistory = ({ history, automatedHistory, onView, onRefresh }: ReportHistoryProps) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset>(null);
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    await deleteReport(deleteId);
    await onRefresh();
    setDeleting(false);
    setDeleteId(null);
  };

  const handlePreset = (preset: Preset) => {
    setActivePreset(preset);
    setCustomRange(undefined);
  };

  const handleClearFilter = () => {
    setActivePreset(null);
    setCustomRange(undefined);
  };

  const filterByDate = (items: ReportHistoryEntry[]) => {
    if (!activePreset) return items;
    const now = new Date();
    return items.filter((entry) => {
      const date = new Date(entry.createdAt);
      if (activePreset === "today") return isToday(date);
      if (activePreset === "yesterday") return isYesterday(date);
      if (activePreset === "last7") return date >= subDays(startOfDay(now), 6) && date <= endOfDay(now);
      if (activePreset === "custom" && customRange?.from) {
        const from = startOfDay(customRange.from);
        const to = endOfDay(customRange.to ?? customRange.from);
        return isWithinInterval(date, { start: from, end: to });
      }
      return true;
    });
  };

  const hasActiveFilter = activePreset !== null;
  const customLabel = customRange?.from
    ? customRange.to
      ? `${format(customRange.from, "MMM d")} – ${format(customRange.to, "MMM d, yyyy")}`
      : format(customRange.from, "MMM d, yyyy")
    : "Custom Range";

  // Empty state component
  const EmptyState = ({ message }: { message: string }) => (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mb-4 border border-brand-100/50">
        <Inbox className="w-7 h-7 text-brand-400" />
      </div>
      <p className="text-sm text-slate-500 max-w-xs">{message}</p>
    </div>
  );

  const renderList = (items: ReportHistoryEntry[], emptyMsg: string) => {
    const filtered = filterByDate(items);
    if (filtered.length === 0) {
      return <EmptyState message={hasActiveFilter ? "No reports match the selected date filter." : emptyMsg} />;
    }

    return (
      <div className="space-y-2.5">
        {filtered.map((entry, i) => (
          <Card
            key={entry.id}
            className="overflow-hidden rounded-xl bg-white/70 backdrop-blur-sm border-l-2 border-l-brand-200 border-t border-r border-b border-t-brand-100/30 border-r-brand-100/30 border-b-brand-100/30 shadow-sm shadow-brand-500/[0.03] hover:border-l-brand-400 hover:shadow-md hover:shadow-brand-500/[0.08] hover:-translate-y-0.5 transition-all duration-300 animate-slide-up"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-slate-800 truncate text-sm">{entry.clientName}</p>
                  {statusBadge(entry.status)}
                </div>
                {entry.jobType !== "competitor" && (
                  <p className="text-xs text-slate-500 truncate">{entry.googleAdsId}</p>
                )}
                <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                  {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {entry.jobType !== "competitor" && (
                    <> · {entry.dateRange.start} — {entry.dateRange.end}</>
                  )}
                </p>
              </div>
              <div className="flex gap-1.5 ml-4 shrink-0">
                {entry.html && entry.status === "complete" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(entry)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-brand-600 hover:bg-brand-50/50 transition-colors"
                    title="View report"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteId(entry.id)}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-destructive hover:bg-red-50/50 transition-colors"
                  title="Delete report"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  const manualWeekly = history.filter(h => h.jobType === "weekly" || !h.jobType);
  const manualAudit = history.filter(h => h.jobType === "audit");
  const manualCompetitor = history.filter(h => h.jobType === "competitor");
  const manualCustom = history.filter(h => h.jobType === "custom");

  const automatedWeekly = automatedHistory.filter(h => h.jobType === "weekly" || !h.jobType);
  const automatedCompetitor = automatedHistory.filter(h => h.jobType === "competitor");

  // Show empty state when no reports exist at all
  if (history.length === 0 && automatedHistory.length === 0) {
    return (
      <div className="mt-10">
        <h3 className="font-display text-xl font-semibold text-slate-800 flex items-center gap-2 mb-6">
          <Clock className="w-5 h-5 text-brand-500" />
          Report History
        </h3>
        <EmptyState message="No reports yet. Generate your first report to see it here!" />
      </div>
    );
  }

  // Date filter bar — shared across both tabs
  const DateFilterBar = () => (
    <div className="flex flex-wrap items-center gap-2 mb-5 p-3 bg-brand-50/30 rounded-xl border border-brand-100/40 backdrop-blur-sm">
      <CalendarDays className="w-4 h-4 text-brand-400 shrink-0" />
      {(["today", "yesterday", "last7"] as const).map((preset) => {
        const labels = { today: "Today", yesterday: "Yesterday", last7: "Last 7 Days" };
        const isActive = activePreset === preset;
        return (
          <button
            key={preset}
            onClick={() => handlePreset(preset)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${isActive
              ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-500/20"
              : "bg-white/80 text-slate-600 border border-brand-100/50 hover:border-brand-200 hover:bg-white"
              }`}
          >
            {labels[preset]}
          </button>
        );
      })}

      {/* Custom Range */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <button
            onClick={() => {
              setActivePreset("custom");
              setCalendarOpen(true);
            }}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${activePreset === "custom"
              ? "bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-500/20"
              : "bg-white/80 text-slate-600 border border-brand-100/50 hover:border-brand-200 hover:bg-white"
              }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {activePreset === "custom" ? customLabel : "Custom Range"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 shadow-xl rounded-xl" align="start">
          <Calendar
            mode="range"
            selected={customRange}
            onSelect={(range) => {
              setCustomRange(range);
              if (range?.from && range?.to) {
                setCalendarOpen(false);
              }
            }}
            disabled={{ after: new Date() }}
            numberOfMonths={2}
            initialFocus
          />
        </PopoverContent>
      </Popover>

      {/* Clear filter */}
      {hasActiveFilter && (
        <button
          onClick={handleClearFilter}
          className="ml-auto text-xs font-medium px-2.5 py-1.5 rounded-lg text-brand-500 hover:text-brand-700 hover:bg-brand-50 flex items-center gap-1 transition-all"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      )}
    </div>
  );

  return (
    <div className="mt-10">
      <Tabs defaultValue="recent" className="w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-display text-xl font-semibold text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-500" />
            Report History
            <div className="h-0.5 w-8 bg-gradient-to-r from-brand-400 to-transparent rounded-full ml-1" />
          </h3>
          <TabsList className="bg-brand-50/50 border border-brand-100/40">
            <TabsTrigger value="recent" className="text-sm data-[state=active]:bg-white data-[state=active]:text-brand-700 data-[state=active]:shadow-sm">Recent</TabsTrigger>
            <TabsTrigger value="automated" className="text-sm gap-1.5 flex items-center data-[state=active]:bg-white data-[state=active]:text-brand-700 data-[state=active]:shadow-sm">
              <Bot className="w-3.5 h-3.5" />
              Automated
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Shared date filter bar */}
        <DateFilterBar />

        <TabsContent value="recent" className="animate-in fade-in duration-300">
          <Accordion type="multiple" defaultValue={["audits", "weekly", "competitor", "custom"]} className="w-full space-y-4">
            <AccordionItem value="audits" className="border-none bg-white/50 backdrop-blur-sm rounded-xl px-4 border border-brand-100/30 data-[state=open]:shadow-sm data-[state=open]:shadow-brand-500/[0.04] transition-all pb-1 border-l-2 border-l-brand-300">
              <AccordionTrigger className="text-sm font-semibold text-slate-700 hover:no-underline py-4">
                Full Account Audits
                <span className="ml-2 text-xs font-normal text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100/50">
                  {filterByDate(manualAudit).length}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-1 pb-2">
                  {renderList(manualAudit, "No recent audits found.")}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="weekly" className="border-none bg-white/50 backdrop-blur-sm rounded-xl px-4 border border-brand-100/30 data-[state=open]:shadow-sm data-[state=open]:shadow-brand-500/[0.04] transition-all pb-1 border-l-2 border-l-brand-300">
              <AccordionTrigger className="text-sm font-semibold text-slate-700 hover:no-underline py-4">
                Weekly Performance Reports
                <span className="ml-2 text-xs font-normal text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full border border-brand-100/50">
                  {filterByDate(manualWeekly).length}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-1 pb-2">
                  {renderList(manualWeekly, "No recent weekly reports found.")}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="competitor" className="border-none bg-white/50 backdrop-blur-sm rounded-xl px-4 border border-teal-100/30 data-[state=open]:shadow-sm data-[state=open]:shadow-teal-500/[0.04] transition-all pb-1 border-l-2 border-l-teal-400">
              <AccordionTrigger className="text-sm font-semibold text-slate-700 hover:no-underline py-4">
                Client Competitor Analysis
                <span className="ml-2 text-xs font-normal text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100/50">
                  {filterByDate(manualCompetitor).length}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-1 pb-2">
                  {renderList(manualCompetitor, "No recent competitor analysis reports found.")}
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="custom" className="border-none bg-white/50 backdrop-blur-sm rounded-xl px-4 border border-orange-100/30 data-[state=open]:shadow-sm data-[state=open]:shadow-orange-500/[0.04] transition-all pb-1 border-l-2 border-l-orange-400">
              <AccordionTrigger className="text-sm font-semibold text-slate-700 hover:no-underline py-4">
                Custom Reports
                <span className="ml-2 text-xs font-normal text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100/50">
                  {filterByDate(manualCustom).length}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="pt-1 pb-2">
                  {renderList(manualCustom, "No custom reports found.")}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>

        <TabsContent value="automated" className="space-y-4 animate-in fade-in duration-300">
          <div className="text-sm text-slate-600 bg-brand-50/50 p-3 rounded-lg border border-brand-100/50 flex items-start gap-2 backdrop-blur-sm">
            <Bot className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" />
            <p>These reports are automatically scheduled and generated by the system. They are accessible to all team members.</p>
          </div>

          {/* Weekly sub-section */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 px-1">Weekly Reports</p>
            {renderList(automatedWeekly, "No automated weekly reports available yet.")}
          </div>

          {/* Competitor sub-section */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-500 mb-3 px-1">Client Competitor Analysis</p>
            {renderList(automatedCompetitor, "No automated competitor analysis reports available yet.")}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete report?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the report and its data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ReportHistory;
