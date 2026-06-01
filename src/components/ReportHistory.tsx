import { useState } from "react";
import { ReportHistoryEntry, deleteReport } from "@/lib/report-history";
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
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground bg-muted px-2 py-0.5 rounded-[4px] border border-border">
      <Loader2 className="w-3 h-3 animate-spin" />
      Processing
    </span>
  );
  if (status === "error") return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive bg-destructive/5 px-2 py-0.5 rounded-[4px] border border-destructive/20">
      <AlertCircle className="w-3 h-3" />
      Failed
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary bg-secondary px-2 py-0.5 rounded-[4px] border border-primary/15">
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
  const EmptyState = ({ message, showHint }: { message: string; showHint?: boolean }) => (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-[4px] border border-border bg-card flex items-center justify-center mb-5 text-primary">
        <Inbox className="w-5 h-5" strokeWidth={1.5} />
      </div>
      <p className="text-xs text-muted-foreground tracking-[0.04em] uppercase max-w-xs">{message}</p>
      {showHint && (
        <p className="micro-label-lg text-primary mt-4 flex items-center gap-1.5">
          <span>↑</span> use the report buttons above to begin
        </p>
      )}
    </div>
  );

  const renderList = (items: ReportHistoryEntry[], emptyMsg: string) => {
    const filtered = filterByDate(items);
    if (filtered.length === 0) {
      return <EmptyState message={hasActiveFilter ? "No reports match the selected date filter." : emptyMsg} />;
    }

    return (
      <div className="space-y-2">
        {filtered.map((entry, i) => (
          <div
            key={entry.id}
            className="history-card overflow-hidden rounded-[4px] bg-card border border-border border-l-2 border-l-primary/50 animate-slide-up"
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <div className="p-4 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <p className="font-semibold text-foreground truncate text-sm tracking-[0.01em]">{entry.clientName}</p>
                  {statusBadge(entry.status)}
                </div>
                {entry.jobType !== "competitor" && (
                  <p className="micro-label-lg text-muted-foreground truncate">{entry.googleAdsId}</p>
                )}
                <p className="micro-label-lg text-muted-foreground/70 mt-1.5 tabular-nums">
                  {new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  {entry.jobType !== "competitor" && (
                    <> · {entry.dateRange.start} — {entry.dateRange.end}</>
                  )}
                </p>
              </div>
              <div className="flex gap-1 ml-4 shrink-0">
                {entry.html && entry.status === "complete" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(entry)}
                    className="h-8 gap-1.5 px-2.5 text-muted-foreground hover:text-primary"
                    title="View report"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:block">View</span>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteId(entry.id)}
                  className="h-8 gap-1.5 px-2.5 text-muted-foreground hover:text-destructive"
                  title="Delete report"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:block">Delete</span>
                </Button>
              </div>
            </div>
          </div>
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

  // Reusable accordion section — uniform tonal treatment
  const Section = ({ value, title, count, children }: { value: string; title: string; count: number; children: React.ReactNode }) => (
    <AccordionItem value={value} className="border border-border border-l-2 border-l-primary/40 rounded-[4px] px-4 data-[state=open]:bg-secondary/30 transition-colors">
      <AccordionTrigger className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground hover:no-underline py-4">
        <span className="flex-1 text-left">{title}</span>
        <span className="ml-2 mr-2 micro-label-lg text-primary bg-secondary px-2 py-0.5 rounded-[4px] border border-primary/15 tabular-nums">
          {count}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="pt-1 pb-3">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );

  // Show empty state when no reports exist at all
  if (history.length === 0 && automatedHistory.length === 0) {
    return (
      <div>
        <h3 className="text-xl text-foreground flex items-center gap-2.5 mb-8">
          <Clock className="w-5 h-5 text-primary" strokeWidth={1.5} />
          Report History
        </h3>
        <EmptyState message="No reports yet. Generate your first report to see it here." showHint />
      </div>
    );
  }

  // Date filter bar — shared across both tabs
  const DateFilterBar = () => (
    <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-card rounded-[4px] border border-border">
      <CalendarDays className="w-4 h-4 text-primary shrink-0" strokeWidth={1.5} />
      {(["today", "yesterday", "last7"] as const).map((preset) => {
        const labels = { today: "Today", yesterday: "Yesterday", last7: "Last 7 Days" };
        const isActive = activePreset === preset;
        return (
          <button
            key={preset}
            onClick={() => handlePreset(preset)}
            className={`text-[10px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 rounded-[4px] transition-colors ${isActive
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground"
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
            className={`text-[10px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 rounded-[4px] transition-colors flex items-center gap-1.5 ${activePreset === "custom"
              ? "bg-primary text-primary-foreground"
              : "bg-background text-muted-foreground border border-border hover:border-primary/50 hover:text-foreground"
              }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            {activePreset === "custom" ? customLabel : "Custom Range"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-[4px]" align="start">
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
          className="ml-auto text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1.5 rounded-[4px] text-primary hover:bg-secondary flex items-center gap-1 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Clear
        </button>
      )}
    </div>
  );

  return (
    <div>
      <Tabs defaultValue="recent" className="w-full">
        <div className="flex items-center justify-between mb-8 pb-5 border-b border-border">
          <h3 className="text-xl text-foreground flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-primary" strokeWidth={1.5} />
            Report History
          </h3>
          <TabsList className="bg-card border border-border rounded-[4px] p-1">
            <TabsTrigger value="recent" className="text-[10px] font-semibold uppercase tracking-[0.12em] rounded-[4px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Recent</TabsTrigger>
            <TabsTrigger value="automated" className="text-[10px] font-semibold uppercase tracking-[0.12em] gap-1.5 flex items-center rounded-[4px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Bot className="w-3.5 h-3.5" />
              Automated
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Shared date filter bar */}
        <DateFilterBar />

        <TabsContent value="recent" className="animate-in fade-in duration-300">
          <Accordion type="multiple" defaultValue={[]} className="w-full space-y-3">
            <Section value="audits" title="Full Account Audits" count={filterByDate(manualAudit).length}>
              {renderList(manualAudit, "No recent audits found.")}
            </Section>
            <Section value="weekly" title="Weekly Performance Reports" count={filterByDate(manualWeekly).length}>
              {renderList(manualWeekly, "No recent weekly reports found.")}
            </Section>
            <Section value="competitor" title="Client Competitor Analysis" count={filterByDate(manualCompetitor).length}>
              {renderList(manualCompetitor, "No recent competitor analysis reports found.")}
            </Section>
            <Section value="custom" title="Custom Reports" count={filterByDate(manualCustom).length}>
              {renderList(manualCustom, "No custom reports found.")}
            </Section>
          </Accordion>
        </TabsContent>

        <TabsContent value="automated" className="space-y-3 animate-in fade-in duration-300">
          <div className="text-xs text-muted-foreground bg-card p-3.5 rounded-[4px] border border-border border-l-2 border-l-primary/40 flex items-start gap-2.5 tracking-[0.02em] leading-relaxed">
            <Bot className="w-4 h-4 text-primary mt-0.5 shrink-0" strokeWidth={1.5} />
            <p>These reports are automatically scheduled and generated by the system. They are accessible to all team members.</p>
          </div>
          <Accordion type="multiple" defaultValue={[]} className="w-full space-y-3">
            <Section value="auto-weekly" title="Weekly Reports" count={filterByDate(automatedWeekly).length}>
              {renderList(automatedWeekly, "No automated weekly reports available yet.")}
            </Section>
            <Section value="auto-competitor" title="Competitor Analysis" count={filterByDate(automatedCompetitor).length}>
              {renderList(automatedCompetitor, "No automated competitor analysis reports available yet.")}
            </Section>
          </Accordion>
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
