import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Building2, ArrowRight, Code2 } from "lucide-react";
import { CLIENT_NAMES } from "@/lib/clients";

interface CustomReportFormProps {
    onSubmit: (data: { clientName: string; html: string }) => void;
    isLoading: boolean;
    onBack?: () => void;
}

const CustomReportForm = ({ onSubmit, isLoading, onBack }: CustomReportFormProps) => {
    const [clientName, setClientName] = useState("");
    const [html, setHtml] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName.trim() || !html.trim()) return;
        onSubmit({ clientName: clientName.trim(), html: html.trim() });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-7">
            <div className="space-y-2.5">
                <Label htmlFor="clientName" className="type-eyebrow text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="w-3 h-3" /> Client Name
                </Label>
                <Select onValueChange={setClientName} value={clientName}>
                    <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                        {CLIENT_NAMES.map((name) => (
                            <SelectItem key={name} value={name}>
                                {name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="space-y-2.5">
                <Label htmlFor="htmlCode" className="type-eyebrow text-muted-foreground flex items-center gap-1.5">
                    <Code2 className="w-3 h-3" /> HTML Report Code
                </Label>
                <Textarea
                    id="htmlCode"
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    placeholder="Paste your HTML report code here…"
                    rows={12}
                    className="font-mono text-xs leading-relaxed resize-y"
                />
            </div>

            <div className="flex flex-col gap-3 pt-2">
                <Button
                    type="submit"
                    disabled={isLoading || !clientName.trim() || !html.trim()}
                    className="w-full h-12"
                >
                    Generate Report
                    <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
                {onBack && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onBack}
                        disabled={isLoading}
                        className="w-full h-12"
                    >
                        Back to Options
                    </Button>
                )}
            </div>
        </form>
    );
};

export default CustomReportForm;
