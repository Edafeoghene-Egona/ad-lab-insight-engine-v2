import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, PlusCircle, Share2, Loader2, Pencil, Save, X, Paintbrush, GripVertical, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEditMode } from "./report-editor/useEditMode";
import { useChartInstances } from "./report-editor/useChartInstances";
import { useSectionReorder } from "./report-editor/SectionReorder";
import EditToolbar from "./report-editor/EditToolbar";
import ChartEditor from "./report-editor/ChartEditor";
import StyleEditor from "./report-editor/StyleEditor";

interface ReportViewerProps {
  html: string;
  businessName: string;
  onNewReport: () => void;
  onBack?: () => void;
  onSaveHtml?: (html: string) => Promise<void>;
}

const ReportViewer = ({ html, businessName, onNewReport, onBack, onSaveHtml }: ReportViewerProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [sharing, setSharing] = useState(false);
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);

  const { editMode, editedHtml, toggleEditMode, extractHtml, setEditedHtml } = useEditMode(iframeRef);
  const { selectedChart, setSelectedChart, updateChart, setupChartClickHandlers } = useChartInstances(iframeRef);
  const { addDragHandles, removeDragHandles } = useSectionReorder(iframeRef);

  // Current HTML to use for download/share (edited version if available)
  const currentHtml = editedHtml || html;

  useEffect(() => {
    if (iframeRef.current) {
      console.log("Rendering report for:", businessName);
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        console.log("Report HTML injected successfully");
      } else {
        console.error("FAILED to access iframe contentDocument. Check sandbox permissions.");
      }
    }
    // Reset edited state when new html comes in
    setEditedHtml(null);
  }, [html, businessName]);

  // Setup chart click handlers when entering edit mode
  useEffect(() => {
    if (editMode) {
      // Small delay to ensure iframe content is ready
      const timer = setTimeout(() => {
        setupChartClickHandlers((chart) => {
          setSelectedChart(chart);
        });
        addDragHandles();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      removeDragHandles();
      setSelectedChart(null);
      setStyleEditorOpen(false);
    }
  }, [editMode]);

  const handleSave = async () => {
    const saved = extractHtml();
    if (saved) {
      if (onSaveHtml) {
        toast.promise(onSaveHtml(saved), {
          loading: "Saving changes...",
          success: () => {
            toggleEditMode();
            return "Changes saved!";
          },
          error: "Failed to save changes"
        });
      } else {
        toggleEditMode();
        toast.success("Changes saved locally!");
      }
    }
  };

  const handleCancelEdit = () => {
    // Restore original HTML
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(editedHtml || html);
        doc.close();
      }
    }
    toggleEditMode();
  };

  const handleDownload = () => {
    const blob = new Blob([currentHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${businessName.replace(/\s+/g, "-").toLowerCase()}-traffic-report.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    setSharing(true);
    try {
      // Extract live DOM state (captures add/remove/contenteditable changes)
      const doc = iframeRef.current?.contentDocument;
      if (!doc) throw new Error("Cannot access report content");

      const clone = doc.documentElement.cloneNode(true) as HTMLElement;
      const body = clone.querySelector("body");
      if (body) {
        // Add view-mode class to disable all editing in shared version
        body.classList.add("view-mode");
        // Remove contenteditable attributes for clean shared HTML
        body.querySelectorAll("[contenteditable]").forEach(el => {
          el.removeAttribute("contenteditable");
        });
        // Remove edit-mode artifacts if present
        clone.querySelector("#edit-mode-styles")?.remove();
        clone.querySelectorAll(".section-drag-handle").forEach(el => el.remove());
        body.removeAttribute("contenteditable");
        body.style.removeProperty("outline");
      }
      const shareHtml = "<!DOCTYPE html>" + clone.outerHTML;

      const baseFilename = `${businessName.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}`;
      const filename = `${baseFilename}.html`;
      const file = new Blob([shareHtml], { type: "text/html" });

      const { error: uploadError } = await supabase.storage
        .from("reports")
        .upload(filename, file, { contentType: "text/html", upsert: false });

      if (uploadError) throw uploadError;

      // Share URL without .html extension to prevent server routing issues (404s)
      const shareUrl = `${window.location.origin}/shared/${baseFilename}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied to clipboard!");
    } catch (err: any) {
      toast.error("Failed to share report: " + (err.message || "Unknown error"));
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Toolbar */}
      <div className="viewer-toolbar px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                className="text-white/70 hover:text-white hover:bg-white/10 h-8 shrink-0"
                title="Go back"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div className="w-px h-5 bg-white/15 shrink-0" />
            </>
          )}
          <div className="min-w-0 flex flex-col">
            <span className="micro-label text-white/45">Report</span>
            <h2 className="text-sm text-white truncate type-engineered">
              {businessName}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStyleEditorOpen(true)}
                className="text-slate-300 hover:text-white hover:bg-white/5 rounded-lg h-8"
                title="Edit styles"
              >
                <Paintbrush className="w-4 h-4 mr-2" />
                Styles
              </Button>
              <div className="w-px h-5 bg-white/10" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="text-slate-300 hover:text-white hover:bg-white/5 rounded-lg h-8"
                title="Cancel editing"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="bg-brand-600 hover:bg-brand-500 text-white rounded-lg h-8"
                title="Save changes"
              >
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleEditMode}
                className="text-slate-300 hover:text-white hover:bg-white/5 rounded-lg h-8"
                title="Edit report content"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <div className="w-px h-5 bg-white/10" />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="text-slate-300 hover:text-white hover:bg-white/5 rounded-lg h-8"
                title="Download as HTML"
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleShare}
                disabled={sharing}
                className="text-slate-300 hover:text-white hover:bg-white/5 rounded-lg h-8"
                title="Share report link"
              >
                {sharing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Share2 className="w-4 h-4 mr-2" />}
                Share
              </Button>
              <div className="w-px h-5 bg-white/10" />
              <Button
                size="sm"
                onClick={onNewReport}
                className="bg-brand-600 hover:bg-brand-500 text-white rounded-lg h-8"
                title="Create new report"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                New Report
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Edit mode banner */}
      {editMode && (
        <div className="bg-brand-500/[0.06] border-b border-brand-500/10 px-6 py-2 flex items-center gap-3 text-sm">
          <Pencil className="h-3.5 w-3.5 text-brand-500" />
          <span className="font-medium text-brand-600">Edit Mode</span>
          <span className="text-muted-foreground text-xs">Click text to edit · Click charts to modify · Drag sections to reorder</span>
        </div>
      )}

      {/* Floating text toolbar */}
      <EditToolbar iframeRef={iframeRef} visible={editMode} />

      {/* Chart editor sidebar */}
      <ChartEditor
        chart={selectedChart}
        onClose={() => setSelectedChart(null)}
        onUpdate={updateChart}
      />

      {/* Style editor sidebar */}
      <StyleEditor
        iframeRef={iframeRef}
        open={styleEditorOpen}
        onClose={() => setStyleEditorOpen(false)}
      />

      {/* Report iframe */}
      <iframe
        ref={iframeRef}
        className="flex-1 w-full border-0"
        title="Traffic Report"
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </div>
  );
};

export default ReportViewer;
