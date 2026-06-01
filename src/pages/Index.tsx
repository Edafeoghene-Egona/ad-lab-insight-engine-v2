import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import adLabLogo from "@/assets/ad-lab-logo.png";
import ReportForm from "@/components/ReportForm";
import CompetitorReportForm from "@/components/CompetitorReportForm";
import CustomReportForm from "@/components/CustomReportForm";
import LoadingState from "@/components/LoadingState";
import ReportViewer from "@/components/ReportViewer";
import ReportHistory from "@/components/ReportHistory";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, FileText, Activity, Search, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initiateReport, pollForCompletion, generateJobId } from "@/lib/api";
import {
  getReportHistory,
  getAutomatedReports,
  createReport,
  updateReport,
  ReportHistoryEntry
} from "@/lib/report-history";

type AppState = "dashboard" | "weekly_form" | "audit_form" | "competitor_form" | "custom_form" | "loading";

const Index = () => {
  const { signOut, user } = useAuth();
  const [state, setState] = useState<AppState>("dashboard");
  const [viewingReport, setViewingReport] = useState(false);
const [currentReportType, setCurrentReportType] = useState<"weekly" | "audit" | "competitor" | "custom">("weekly");
  const [clientName, setClientName] = useState("");
  const [reportHtml, setReportHtml] = useState("");
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [history, setHistory] = useState<ReportHistoryEntry[]>([]);
  const [automatedHistory, setAutomatedHistory] = useState<ReportHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentJobIdRef = useRef<string | null>(null);
  const savedScrollYRef = useRef(0);

  const refreshHistory = useCallback(async () => {
    const [data, autoData] = await Promise.all([
      getReportHistory(),
      getAutomatedReports()
    ]);
    setHistory(data);
    setAutomatedHistory(autoData);
  }, []);

  useEffect(() => {
    refreshHistory().finally(() => setHistoryLoading(false));
  }, [refreshHistory]);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollRef.current = null;
    timerRef.current = null;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // Quick stats
  const stats = useMemo(() => {
    const all = [...history, ...automatedHistory];
    const total = all.length;
    const now = new Date();
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    const thisWeek = all.filter(r => new Date(r.createdAt) >= weekAgo).length;
    const lastReport = all.length > 0
      ? new Date(all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt)
        .toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : "—";
    return { total, thisWeek, lastReport };
  }, [history, automatedHistory]);

  const handleCompetitorSubmit = async (data: { clientName: string }) => {
    await handleSubmit({
      clientName: data.clientName,
      googleAdsId: "N/A",
      startDate: "1970-01-01",
      endDate: "1970-01-01",
    });
  };

  const handleCustomSubmit = async (data: { clientName: string; html: string }) => {
    if (!user) return;
    setClientName(data.clientName);
    try {
      const job_id = generateJobId();
      await createReport({
        jobId: job_id,
        userId: user.id,
        clientName: data.clientName,
        googleAdsId: "N/A",
        jobType: "custom",
        dateRange: { start: "1970-01-01", end: "1970-01-01" },
      });
      await updateReport(job_id, { status: "complete", html: data.html });
      await refreshHistory();
      setReportHtml(data.html);
      setCurrentJobId(job_id);
      savedScrollYRef.current = window.scrollY;
      setState("dashboard");
      setViewingReport(true);
      toast.success("Custom report saved successfully!");
    } catch {
      toast.error("Failed to save custom report. Please try again.");
    }
  };

  const handleSubmit = async (data: {
    clientName: string;
    googleAdsId: string;
    startDate: string;
    endDate: string;
  }) => {
    if (!user) return;

    setClientName(data.clientName);
    setState("loading");
    setElapsed(0);

    try {
      const job_id = generateJobId();
      currentJobIdRef.current = job_id;

      // 1. Persist the job to Supabase immediately
      await createReport({
        jobId: job_id,
        userId: user.id,
        clientName: data.clientName,
        googleAdsId: data.googleAdsId,
        jobType: currentReportType,
        dateRange: { start: data.startDate, end: data.endDate },
      });

      // 2. Kick off n8n workflow
      await initiateReport({
        job_id,
        client_name: data.clientName,
        google_ads_id: data.googleAdsId,
        date_range: { start: data.startDate, end: data.endDate },
        reportType: currentReportType as "weekly" | "audit" | "competitor",
      });

      // Refresh history to show our new pending job
      await refreshHistory();

      timerRef.current = setInterval(() => {
        setElapsed((s) => s + 1);
      }, 1000);

      let attempts = 0;
      const maxAttempts = 10; // Poll once per minute for up to 10 minutes

      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const result = await pollForCompletion(job_id, currentReportType as "weekly" | "audit" | "competitor");

          if (result.status === "complete" && result.html) {
            cleanup();
            // Update Supabase with the final HTML
            await updateReport(job_id, { status: "complete", html: result.html });
            setReportHtml(result.html);
            setCurrentJobId(job_id);
            await refreshHistory();
            savedScrollYRef.current = 0;
            setState("dashboard");
            setViewingReport(true);
            toast.success("Report generated successfully!");
          } else if (result.status === "error") {
            cleanup();
            await updateReport(job_id, { status: "error" });
            await refreshHistory();
            setState(currentReportType === "weekly" ? "weekly_form" : currentReportType === "audit" ? "audit_form" : "competitor_form");
            toast.error(result.error || "Report generation failed. Please try again.");
          } else if (attempts >= maxAttempts) {
            cleanup();
            await updateReport(job_id, { status: "error" });
            await refreshHistory();
            setState(currentReportType === "weekly" ? "weekly_form" : currentReportType === "audit" ? "audit_form" : "competitor_form");
            toast.error("Report generation timed out. Please try again.");
          }
        } catch {
          if (attempts >= maxAttempts) {
            cleanup();
            await updateReport(job_id, { status: "error" });
            await refreshHistory();
            setState(currentReportType === "weekly" ? "weekly_form" : currentReportType === "audit" ? "audit_form" : "competitor_form");
            toast.error("Report generation timed out. Please try again.");
          }
        }
      }, 60000); // Poll every 60 seconds
    } catch {
      setState(currentReportType === "weekly" ? "weekly_form" : currentReportType === "audit" ? "audit_form" : "competitor_form");
      toast.error("Failed to initiate report. Please check your connection and try again.");
    }
  };

  const handleNewReport = () => {
    cleanup();
    setReportHtml("");
    setClientName("");
    setCurrentJobId(null);
    setViewingReport(false);
    setState("dashboard");
  };

  const handleViewHistory = (entry: ReportHistoryEntry) => {
    if (entry.html) {
      savedScrollYRef.current = window.scrollY;
      setClientName(entry.clientName);
      setReportHtml(entry.html);
      setCurrentJobId(entry.jobId);
      setViewingReport(true);
    }
  };

  const handleBack = () => {
    setViewingReport(false);
    requestAnimationFrame(() => {
      window.scrollTo(0, savedScrollYRef.current);
    });
  };

  const handleSaveReportHtml = async (html: string) => {
    if (!currentJobId) return;
    await updateReport(currentJobId, { status: "complete", html });
    setReportHtml(html);
    await refreshHistory();
  };

  if (state === "loading") {
    return <LoadingState businessName={clientName} elapsedSeconds={elapsed} />;
  }

  const firstName = user?.email?.split("@")[0] || "there";

  return (
    <>
    {viewingReport && (
      <ReportViewer
        html={reportHtml}
        businessName={clientName}
        onNewReport={handleNewReport}
        onBack={handleBack}
        onSaveHtml={handleSaveReportHtml}
      />
    )}
    <div className="dashboard-page min-h-screen relative overflow-x-hidden selection:bg-primary/20" style={{ display: viewingReport ? 'none' : undefined }}>

      {/* Top Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={adLabLogo} alt="Ad-Lab" className="h-7 w-7 rounded-[4px] object-cover" />
            <span className="type-eyebrow text-foreground hidden sm:block">Insight&nbsp;Engine</span>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden md:flex items-center gap-2 text-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary live-dot" />
              <span className="type-eyebrow text-muted-foreground">{firstName}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="group border-border text-foreground hover:border-primary/60"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5 group-hover:-translate-x-0.5 transition-transform" />
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-16 blueprint-grid border-b border-border">
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 relative">
          {/* corner ticks */}
          <span className="bp-tick absolute left-6 md:left-10 top-12 w-2.5 h-2.5" />
          <span className="micro-label absolute right-6 md:right-10 top-12">Ad-Lab / Traffic Intelligence — v2.0</span>

          <div className="pt-24 pb-24 md:pt-28 md:pb-28 animate-reveal">
            <span className="type-eyebrow text-primary block mb-7">[ Data Engine ]</span>
            <h1 className="text-[clamp(3rem,9vw,7rem)] text-foreground mb-8 max-w-4xl">
              Traffic<br />
              <span className="text-primary">Intelligence</span>
            </h1>
            <p className="text-sm md:text-base text-muted-foreground max-w-md leading-relaxed tracking-[0.01em] mb-10">
              In-depth, AI-powered traffic analysis and account audits for any client — generated in minutes.
            </p>
            <div className="flex flex-wrap gap-x-8 gap-y-2 pt-8 border-t border-border max-w-2xl">
              {["Weekly Reports", "Account Audits", "Competitor Analysis"].map((t, i) => (
                <span key={t} className="type-eyebrow text-muted-foreground flex items-center gap-2">
                  <span className="micro-label-accent micro-label">0{i + 1}</span> {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats + Report Type Selection */}
      {state === "dashboard" && (
      <section className="relative max-w-[1200px] mx-auto px-6 md:px-10 pt-16 md:pt-20">

        {/* Quick Stats — horizontal band */}
        {!historyLoading && (history.length > 0 || automatedHistory.length > 0) && (
          <div className="animate-slide-up grid grid-cols-3 border border-border bg-card rounded-[4px] mb-16 divide-x divide-border">
            <div className="p-6 md:p-8 relative">
              <span className="micro-label-lg text-muted-foreground block mb-3">001 / Total Reports</span>
              <p className="text-3xl md:text-4xl text-foreground type-engineered">{stats.total}</p>
            </div>
            <div className="p-6 md:p-8">
              <span className="micro-label-lg text-muted-foreground block mb-3">002 / This Week</span>
              <p className="text-3xl md:text-4xl text-primary type-engineered">{stats.thisWeek}</p>
            </div>
            <div className="p-6 md:p-8">
              <span className="micro-label-lg text-muted-foreground block mb-3">003 / Last Report</span>
              <p className="text-2xl md:text-3xl text-foreground type-engineered">{stats.lastReport}</p>
            </div>
          </div>
        )}

        {/* Section header */}
        <div className="flex items-end justify-between mb-8">
          <h2 className="text-2xl md:text-3xl text-foreground">Generate Report</h2>
          <span className="micro-label hidden sm:block">select a vertical ↓</span>
        </div>

        {/* Report Type Selection */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-4">
          {[
            { key: "weekly", state: "weekly_form", icon: Activity, no: "01", title: "Weekly Report", desc: "Standard performance metrics" },
            { key: "audit", state: "audit_form", icon: FileText, no: "02", title: "Account Audit", desc: "Deep-dive structure analysis" },
            { key: "competitor", state: "competitor_form", icon: Search, no: "03", title: "Competitor Analysis", desc: "Competitive landscape report" },
            { key: "custom", state: "custom_form", icon: Code2, no: "04", title: "Custom Report", desc: "Paste & visualise HTML report" },
          ].map(({ key, state: target, icon: Icon, no, title, desc }) => (
            <button
              key={key}
              onClick={() => {
                setCurrentReportType(key as "weekly" | "audit" | "competitor" | "custom");
                setState(target as AppState);
              }}
              className="report-type-card group relative p-6 text-left flex flex-col min-h-[180px]"
            >
              <div className="flex items-start justify-between mb-auto">
                <Icon className="w-6 h-6 text-primary" strokeWidth={1.5} />
                <span className="micro-label-lg text-muted-foreground/70 group-hover:text-primary transition-colors">{no}</span>
              </div>
              <h3 className="text-base text-foreground mb-2 mt-6">{title}</h3>
              <p className="text-xs text-muted-foreground tracking-[0.02em] leading-relaxed normal-case">{desc}</p>
              <span className="micro-label absolute bottom-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity">open →</span>
            </button>
          ))}
        </div>
      </section>
      )}

      {/* Main content area (Forms & History) */}
      <main className={`relative z-10 max-w-[1200px] mx-auto px-6 md:px-10 pb-28${state !== "dashboard" ? " pt-24 md:pt-28" : " pt-20"}`}>

        {/* Dynamic Forms Container */}
        <div className="animate-form-reveal">
          {state === "weekly_form" && (
            <div className="max-w-xl mx-auto bg-card border border-border rounded-[4px] p-8 md:p-10 relative">
              <span className="micro-label absolute top-4 right-5">form / weekly · 01</span>
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
                <div className="p-3 border border-border rounded-[4px] text-primary">
                  <Activity className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-lg text-foreground">Weekly Performance</h2>
                  <p className="text-xs text-muted-foreground tracking-[0.04em] uppercase mt-1">Configure report parameters</p>
                </div>
              </div>
              <ReportForm
                onSubmit={handleSubmit}
                isLoading={false}
                submitLabel="Generate Weekly Report"
                onBack={() => setState("dashboard")}
              />
            </div>
          )}

          {state === "audit_form" && (
            <div className="max-w-xl mx-auto bg-card border border-border rounded-[4px] p-8 md:p-10 relative">
              <span className="micro-label absolute top-4 right-5">form / audit · 02</span>
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
                <div className="p-3 border border-border rounded-[4px] text-primary">
                  <FileText className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-lg text-foreground">Full Account Audit</h2>
                  <p className="text-xs text-muted-foreground tracking-[0.04em] uppercase mt-1">Configure audit parameters</p>
                </div>
              </div>
              <ReportForm
                onSubmit={handleSubmit}
                isLoading={false}
                submitLabel="Generate Audit"
                onBack={() => setState("dashboard")}
                allowCustomClientName={true}
              />
            </div>
          )}

          {state === "competitor_form" && (
            <div className="max-w-xl mx-auto bg-card border border-border rounded-[4px] p-8 md:p-10 relative">
              <span className="micro-label absolute top-4 right-5">form / competitor · 03</span>
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
                <div className="p-3 border border-border rounded-[4px] text-primary">
                  <Search className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-lg text-foreground">Client Competitor Analysis</h2>
                  <p className="text-xs text-muted-foreground tracking-[0.04em] uppercase mt-1">Select client to analyse</p>
                </div>
              </div>
              <CompetitorReportForm
                onSubmit={handleCompetitorSubmit}
                isLoading={false}
                onBack={() => setState("dashboard")}
              />
            </div>
          )}

          {state === "custom_form" && (
            <div className="max-w-xl mx-auto bg-card border border-border rounded-[4px] p-8 md:p-10 relative">
              <span className="micro-label absolute top-4 right-5">form / custom · 04</span>
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-border">
                <div className="p-3 border border-border rounded-[4px] text-primary">
                  <Code2 className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-lg text-foreground">Add Custom Report</h2>
                  <p className="text-xs text-muted-foreground tracking-[0.04em] uppercase mt-1">Paste HTML to visualise your report</p>
                </div>
              </div>
              <CustomReportForm
                onSubmit={handleCustomSubmit}
                isLoading={false}
                onBack={() => setState("dashboard")}
              />
            </div>
          )}
        </div>

        {/* History Component */}
        {!historyLoading && state === "dashboard" && (
          <div className="animate-slide-up mt-20">
            <ReportHistory
              history={history}
              automatedHistory={automatedHistory}
              onView={handleViewHistory}
              onRefresh={refreshHistory}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-[1200px] mx-auto px-6 md:px-10 py-10 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2.5">
            <img src={adLabLogo} alt="Ad-Lab" className="h-5 w-5 rounded-[4px] grayscale opacity-50" />
            <span className="type-eyebrow text-muted-foreground">Insight Engine</span>
          </div>
          <span className="micro-label">© {new Date().getFullYear()} Ad-Lab — all rights reserved · internal tool</span>
        </div>
      </footer>
    </div>
    </>
  );
};

export default Index;