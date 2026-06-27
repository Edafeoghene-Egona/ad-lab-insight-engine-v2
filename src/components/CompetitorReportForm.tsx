import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Building2, ArrowRight } from "lucide-react";
import { CLIENT_NAMES } from "@/lib/clients";

interface CompetitorReportFormProps {
    onSubmit: (data: { clientName: string }) => void;
    isLoading: boolean;
    onBack?: () => void;
}

const CompetitorReportForm = ({ onSubmit, isLoading, onBack }: CompetitorReportFormProps) => {
    const [clientName, setClientName] = useState("");

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientName.trim()) return;
        onSubmit({ clientName: clientName.trim() });
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

            <div className="flex flex-col gap-3 pt-2">
                <Button
                    type="submit"
                    disabled={isLoading || !clientName.trim()}
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

export default CompetitorReportForm;
