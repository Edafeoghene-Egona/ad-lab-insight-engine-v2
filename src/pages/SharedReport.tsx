import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

const SharedReport = () => {
  const { id } = useParams<{ id: string }>();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      console.log("[SharedReport] Route param id:", id);

      if (!id) {
        console.error("[SharedReport] No report ID provided in URL");
        setError("No report ID provided.");
        setLoading(false);
        return;
      }

      try {
        // Ensure Supabase looks for the .html version
        const filenameToDownload = id.endsWith(".html") ? id : `${id}.html`;
        console.log("[SharedReport] Downloading from storage:", filenameToDownload);

        const { data, error: downloadError } = await supabase.storage
          .from("reports")
          .download(filenameToDownload);

        if (downloadError) {
          console.error("[SharedReport] Download error:", downloadError);
          throw downloadError;
        }

        if (data) {
          console.log("[SharedReport] Blob received, size:", data.size, "type:", data.type);
          const text = await data.text();
          console.log("[SharedReport] HTML length:", text.length, "| First 200 chars:", text.substring(0, 200));

          if (!text || text.length === 0) {
            throw new Error("Downloaded file is empty");
          }

          // Create a blob URL — works reliably for large/complex HTML
          const blob = new Blob([text], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          console.log("[SharedReport] Blob URL created:", url);
          setBlobUrl(url);
        } else {
          throw new Error("No data returned from storage");
        }
      } catch (err: any) {
        console.error("[SharedReport] Final error:", err);
        setError("Report not found. The link might be broken or the file may have been deleted.");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();

    // Cleanup blob URL on unmount
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background blueprint-grid">
        <div className="flex flex-col items-center gap-5">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-border border-t-primary" />
          <p className="type-eyebrow text-muted-foreground">Loading report</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background blueprint-grid p-6 text-center">
        <div className="border border-destructive/20 bg-destructive/5 p-3.5 rounded-[4px] mb-6 text-destructive">
          <X className="w-7 h-7" strokeWidth={1.5} />
        </div>
        <h1 className="text-xl text-foreground mb-3">Something went wrong</h1>
        <p className="text-xs text-muted-foreground tracking-[0.03em] uppercase max-w-sm leading-relaxed">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-8 px-5 h-10 bg-primary text-primary-foreground rounded-[4px] text-xs font-semibold uppercase tracking-[0.12em] hover:bg-[hsl(286_79%_58%)] transition-colors"
        >
          Try Again
        </button>
        <span className="micro-label mt-10">Ad-Lab — shared report</span>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background blueprint-grid">
        <p className="type-eyebrow text-muted-foreground">No report content available</p>
      </div>
    );
  }

  return (
    <iframe
      className="w-full h-screen border-0"
      title="Shared Report"
      src={blobUrl}
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
    />
  );
};

export default SharedReport;
