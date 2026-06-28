import { useEffect, useState } from "react";
import { Copy, Check, RefreshCw, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CosButton } from "./CosButton";
import { useAuth } from "@/contexts/AuthContext";
import {
  getOrCreateShareLink,
  setRevoked,
  regenerateShareLink,
  shareUrl,
  type ShareLinkRow,
} from "@/lib/client-share-links";

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  clientName: string;
}

export function ShareLinkDialog({ open, onOpenChange, customerId, clientName }: ShareLinkDialogProps) {
  const { user } = useAuth();
  const [row, setRow] = useState<ShareLinkRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Get-or-create the link whenever the dialog opens for a client.
  useEffect(() => {
    if (!open || !customerId || !user?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRow(null);
    getOrCreateShareLink({ customerId, clientName }, { userId: user.id })
      .then((r) => !cancelled && setRow(r))
      .catch((e) => !cancelled && setError(e?.message ?? "Could not load the share link."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, customerId, clientName, user?.id]);

  const url = row ? shareUrl(row.token) : "";

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setCopied(false), 1800);
  };

  const toggleRevoke = async () => {
    if (!row) return;
    setBusy(true);
    try {
      await setRevoked(customerId, !row.revoked);
      setRow({ ...row, revoked: !row.revoked });
      toast.success(row.revoked ? "Link re-enabled" : "Link revoked");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    if (!window.confirm("Generate a new link? The current link will stop working immediately.")) return;
    setBusy(true);
    try {
      const next = await regenerateShareLink(customerId);
      setRow(next);
      toast.success("New link generated");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Could not regenerate the link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share {clientName}'s dashboard</DialogTitle>
          <DialogDescription>
            Anyone with this link can view this client's live deep-dive — no sign-in required. They
            only ever see {clientName}'s data.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading link…
          </div>
        ) : error ? (
          <p className="text-sm text-red-600 py-4">{error}</p>
        ) : row ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input readOnly value={url} className="text-xs" onFocus={(e) => e.currentTarget.select()} />
              <CosButton variant="outline" size="icon" onClick={copy} aria-label="Copy link">
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </CosButton>
            </div>

            {row.revoked && (
              <p className="text-xs font-semibold text-amber-600">
                This link is revoked — it currently shows an inactive message to anyone who opens it.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <CosButton variant={row.revoked ? "brand" : "outline"} disabled={busy} onClick={toggleRevoke}>
                <Ban className="w-3.5 h-3.5" />
                {row.revoked ? "Re-enable link" : "Revoke link"}
              </CosButton>
              <CosButton variant="outline" disabled={busy} onClick={regenerate}>
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </CosButton>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
