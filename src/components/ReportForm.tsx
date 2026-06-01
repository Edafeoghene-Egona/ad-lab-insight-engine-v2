import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { CalendarIcon, Hash, Building2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLIENT_NAMES } from "@/lib/clients";

interface ReportFormProps {
  onSubmit: (data: { clientName: string; googleAdsId: string; startDate: string; endDate: string }) => void;
  isLoading: boolean;
  submitLabel?: string;
  onBack?: () => void;
  showDates?: boolean;
  allowCustomClientName?: boolean;
}

const ReportForm = ({
  onSubmit,
  isLoading,
  submitLabel = "Generate Report",
  onBack,
  showDates = true,
  allowCustomClientName = false
}: ReportFormProps) => {
  const [clientName, setClientName] = useState("");
  const [googleAdsId, setGoogleAdsId] = useState("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !googleAdsId.trim()) return;

    if (showDates && (!startDate || !endDate)) return;

    onSubmit({
      clientName: clientName.trim(),
      googleAdsId: googleAdsId.trim(),
      startDate: startDate ? format(startDate, "yyyy-MM-dd") : "1970-01-01",
      endDate: endDate ? format(endDate, "yyyy-MM-dd") : "1970-01-01",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-7">
      <div className="space-y-2.5">
        <Label htmlFor="clientName" className="type-eyebrow text-muted-foreground flex items-center gap-1.5">
          <Building2 className="w-3 h-3" /> Client Name
        </Label>
        {allowCustomClientName ? (
          <Input
            id="clientName"
            type="text"
            placeholder="Type client name…"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            required
          />
        ) : (
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
        )}
      </div>

      <div className="space-y-2.5">
        <Label htmlFor="googleAdsId" className="type-eyebrow text-muted-foreground flex items-center gap-1.5">
          <Hash className="w-3 h-3" /> Google Ads ID
        </Label>
        <Input
          id="googleAdsId"
          type="text"
          placeholder="e.g. 123-456-7890"
          value={googleAdsId}
          onChange={(e) => setGoogleAdsId(e.target.value)}
          required
          maxLength={255}
        />
      </div>

      {showDates && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2.5">
            <Label className="type-eyebrow text-muted-foreground flex items-center gap-1.5">
              <CalendarIcon className="w-3 h-3" /> Start Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    "w-full h-11 justify-start text-left normal-case tracking-normal font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "MMM d, yyyy") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2.5">
            <Label className="type-eyebrow text-muted-foreground flex items-center gap-1.5">
              <CalendarIcon className="w-3 h-3" /> End Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    "w-full h-11 justify-start text-left normal-case tracking-normal font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "MMM d, yyyy") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  disabled={(date) => startDate ? date < startDate : false}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 pt-2">
        <Button
          type="submit"
          disabled={isLoading || !clientName.trim() || !googleAdsId.trim() || (showDates && (!startDate || !endDate))}
          className="w-full h-12"
        >
          {submitLabel}
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

export default ReportForm;
