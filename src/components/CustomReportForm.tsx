import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
        <Card className="border border-white/10 shadow-2xl bg-white rounded-2xl overflow-hidden">
            <CardContent className="p-8 md:p-10">
                <form onSubmit={handleSubmit} className="space-y-7">
                    <div className="space-y-2">
                        <Label htmlFor="clientName" className="text-xs font-bold uppercase tracking-widest text-slate-500">
                            <Building2 className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                            Client Name
                        </Label>
                        <Select onValueChange={setClientName} value={clientName}>
                            <SelectTrigger className="h-12 text-base border-slate-200 bg-slate-50 focus:bg-white focus:border-orange-500 focus:ring-orange-500/20 rounded-xl transition-all">
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

                    <div className="space-y-2">
                        <Label htmlFor="htmlCode" className="text-xs font-bold uppercase tracking-widest text-slate-500">
                            <Code2 className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" />
                            HTML Report Code
                        </Label>
                        <textarea
                            id="htmlCode"
                            value={html}
                            onChange={(e) => setHtml(e.target.value)}
                            placeholder="Paste your HTML report code here..."
                            rows={12}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-mono text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition-all resize-y"
                        />
                    </div>

                    <div className="flex flex-col gap-3">
                        <Button
                            type="submit"
                            disabled={isLoading || !clientName.trim() || !html.trim()}
                            className="w-full h-14 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white"
                        >
                            Generate Report
                            <ArrowRight className="ml-2 w-5 h-5" />
                        </Button>
                        {onBack && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onBack}
                                disabled={isLoading}
                                className="w-full h-14 text-lg font-semibold rounded-xl text-slate-600 hover:text-slate-900 border-slate-200 hover:bg-slate-50 transition-all duration-300"
                            >
                                Back to Options
                            </Button>
                        )}
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};

export default CustomReportForm;
