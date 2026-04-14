import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import adLabLogo from "@/assets/ad-lab-logo.png";
import customHero from "@/assets/custom_hero.png";
import ReportForm from "@/components/ReportForm";
import CompetitorReportForm from "@/components/CompetitorReportForm";
import CustomReportForm from "@/components/CustomReportForm";
import LoadingState from "@/components/LoadingState";
import ReportViewer from "@/components/ReportViewer";
import ReportHistory from "@/components/ReportHistory";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Sparkles, FileText, Activity, Search, Code2 } from "lucide-react";
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
    <div className="dashboard-page min-h-screen relative overflow-x-hidden bg-white selection:bg-brand-500/30" style={{ display: viewingReport ? 'none' : undefined }}>

      {/* Top Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-brand-100/50 py-4 px-6 md:px-12 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={adLabLogo} alt="Ad-Lab" className="h-8 rounded-lg shadow-sm" />
          <span className="font-bold text-slate-800 tracking-tight hidden sm:block">Intelligence Platform</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-sm text-brand-700">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 live-dot" />
            Welcome back, <span className="font-semibold">{firstName}</span>
          </div>

          <Button
            variant="ghost"
            onClick={signOut}
            className="text-slate-600 hover:text-red-600 hover:bg-red-50 group transition-all duration-300 rounded-full pl-3 pr-4"
          >
            <LogOut className="w-4 h-4 mr-2 group-hover:-translate-x-0.5 transition-transform" />
            Sign Out
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-28 pb-16 md:pb-24 lg:min-h-[50vh] flex items-center">
        {/* Background Split */}
        <div className="absolute inset-0 flex">
          <div className="w-full lg:w-[45%] bg-white hero-texture relative z-10" />
          {/* Right side image with gradient fade on the left edge */}
          <div className="hidden lg:block w-[55%] relative flex items-center justify-end p-8">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-white via-white/100 to-transparent z-10 w-48" />
            <img
              src={customHero}
              alt="Retro Data Intelligence"
              className="w-full max-h-[75vh] object-contain object-right ml-auto relative z-0"
            />
            {/* Subtle overlay to fade the image slightly */}
            <div className="absolute inset-0 bg-brand-900/5 mix-blend-overlay z-10 pointer-events-none" />
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 md:px-12 w-full relative z-20 flex flex-col lg:flex-row items-center">
          {/* Left Content */}
          <div className="w-full lg:w-[50%] animate-fade-in lg:pr-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-xs font-semibold text-brand-600 tracking-wide uppercase mb-6 border border-brand-100">
              <Sparkles className="w-3.5 h-3.5" /> Data Engine v2.0
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-[1.1] mb-6 tracking-tight">
              Traffic <br /><span className="text-brand-600">Intelligence.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-500 mb-6 max-w-lg leading-relaxed">
              Generate in-depth, AI-powered traffic analysis and account audit reports for any client in minutes.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-600">
                <Activity className="w-3 h-3 text-brand-500" /> Weekly Reports
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-600">
                <FileText className="w-3 h-3 text-purple-500" /> Account Audits
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-600">
                <Search className="w-3 h-3 text-teal-500" /> Competitor Analysis
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Floating Action Bar */}
      {state === "dashboard" && (
      <section className="relative z-30 max-w-6xl mx-auto px-6 md:px-12 -mt-10 md:-mt-16 mb-16">
        <div className="bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 p-2 md:p-3 animate-slide-up flex flex-col md:flex-row items-stretch gap-3">

          {/* Stats Section inside Action Bar */}
          {!historyLoading && (history.length > 0 || automatedHistory.length > 0) && (
            <div className="flex-1 flex items-center justify-around bg-slate-50 rounded-2xl p-4 md:p-6 shadow-inner border border-slate-100/50">
              <div className="text-center px-4">
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 block mb-1">Total Reports</span>
                <p className="text-2xl md:text-3xl font-black text-slate-800">{stats.total}</p>
              </div>
              <div className="w-px h-12 bg-slate-200" />
              <div className="text-center px-4">
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 block mb-1">This Week</span>
                <p className="text-2xl md:text-3xl font-black text-brand-600">{stats.thisWeek}</p>
              </div>
              <div className="w-px h-12 bg-slate-200 hidden sm:block" />
              <div className="text-center px-4 hidden sm:block">
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 block mb-1">Last Report</span>
                <p className="text-lg md:text-xl font-bold text-slate-800 mt-1">{stats.lastReport}</p>
              </div>
            </div>
          )}

          {/* Action Buttons Section */}
          {state === "dashboard" && (
            <div className="flex-[1.5] flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setCurrentReportType("weekly");
                  setState("weekly_form");
                }}
                className="flex-1 group relative overflow-hidden bg-brand-600 hover:bg-brand-700 text-white rounded-2xl p-6 text-left transition-all duration-300 shadow-lg shadow-brand-500/25 hover:shadow-brand-500/40 hover:-translate-y-1"
              >
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-brand-500 blur-2xl opacity-50 group-hover:bg-brand-400 transition-colors" />
                <Activity className="w-8 h-8 text-brand-100 mb-4 relative z-10" />
                <h3 className="font-bold text-lg mb-1 relative z-10">Weekly Report</h3>
                <p className="text-brand-100 text-sm opacity-80 relative z-10">Standard performance metrics</p>
              </button>

              <button
                onClick={() => {
                  setCurrentReportType("audit");
                  setState("audit_form");
                }}
                className="flex-1 group relative overflow-hidden bg-slate-900 hover:bg-slate-800 text-white rounded-2xl p-6 text-left transition-all duration-300 shadow-lg shadow-slate-900/20 hover:shadow-slate-900/30 hover:-translate-y-1"
              >
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-purple-500 blur-2xl opacity-20 group-hover:opacity-30 transition-opacity" />
                <FileText className="w-8 h-8 text-purple-300 mb-4 relative z-10" />
                <h3 className="font-bold text-lg mb-1 relative z-10">Account Audit</h3>
                <p className="text-slate-400 text-sm relative z-10">Deep dive structure analysis</p>
              </button>

              <button
                onClick={() => {
                  setCurrentReportType("competitor");
                  setState("competitor_form");
                }}
                className="flex-1 group relative overflow-hidden bg-teal-700 hover:bg-teal-600 text-white rounded-2xl p-6 text-left transition-all duration-300 shadow-lg shadow-teal-700/20 hover:shadow-teal-600/30 hover:-translate-y-1"
              >
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-teal-500 blur-2xl opacity-20 group-hover:opacity-30 transition-opacity" />
                <Search className="w-8 h-8 text-teal-200 mb-4 relative z-10" />
                <h3 className="font-bold text-lg mb-1 relative z-10">Competitor Analysis</h3>
                <p className="text-teal-200 text-sm opacity-80 relative z-10">Competitive landscape report</p>
              </button>

              <button
                onClick={() => {
                  setCurrentReportType("custom");
                  setState("custom_form");
                }}
                className="flex-1 group relative overflow-hidden bg-orange-600 hover:bg-orange-500 text-white rounded-2xl p-6 text-left transition-all duration-300 shadow-lg shadow-orange-600/20 hover:shadow-orange-500/30 hover:-translate-y-1"
              >
                <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-orange-400 blur-2xl opacity-20 group-hover:opacity-30 transition-opacity" />
                <Code2 className="w-8 h-8 text-orange-100 mb-4 relative z-10" />
                <h3 className="font-bold text-lg mb-1 relative z-10">Custom Report</h3>
                <p className="text-orange-100 text-sm opacity-80 relative z-10">Paste & visualise HTML report</p>
              </button>
            </div>
          )}

        </div>
      </section>
      )}

      {/* Main content area (Forms & History) */}
      <main className={`relative z-10 max-w-5xl mx-auto px-6 md:px-12 pb-24${state !== "dashboard" ? " pt-12" : ""}`}>

        {/* Dynamic Forms Container */}
        <div className="animate-form-reveal">
          {state === "weekly_form" && (
            <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                <div className="p-2.5 bg-brand-50 rounded-xl">
                  <Activity className="w-6 h-6 text-brand-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Weekly Performance</h2>
                  <p className="text-sm text-slate-500">Configure report parameters</p>
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
            <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                <div className="p-2.5 bg-purple-50 rounded-xl">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Full Account Audit</h2>
                  <p className="text-sm text-slate-500">Configure audit parameters</p>
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
            <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                <div className="p-2.5 bg-teal-50 rounded-xl">
                  <Search className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Client Competitor Analysis</h2>
                  <p className="text-sm text-slate-500">Select client to analyse</p>
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
            <div className="max-w-xl mx-auto bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-100">
                <div className="p-2.5 bg-orange-50 rounded-xl">
                  <Code2 className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Add Custom Report</h2>
                  <p className="text-sm text-slate-500">Paste HTML to visualise your report</p>
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
          <div className="animate-slide-up mt-8">
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
      <footer className="bg-slate-50 border-t border-slate-200/60 pb-8 pt-12 mt-20">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src={adLabLogo} alt="Ad-Lab" className="h-6 grayscale opacity-60" />
            <span className="text-sm text-slate-400 font-medium">Traffic Intelligence</span>
          </div>
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} Ad-Lab. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
    </>
  );
};

export default Index;