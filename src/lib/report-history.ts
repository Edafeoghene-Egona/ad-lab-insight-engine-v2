import { supabase } from "@/integrations/supabase/client";

export interface ReportHistoryEntry {
  id: string;         // UUID from DB
  jobId: string;      // n8n job_id
  clientName: string;
  googleAdsId: string;
  dateRange: { start: string; end: string };
  createdAt: string;
  status: "pending" | "complete" | "error";
  jobType?: string;
  html?: string;
}

/** Fetch all reports for the current authenticated user, newest first. Excludes automated global jobs if any crept in. */
export async function getReportHistory(): Promise<ReportHistoryEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("report_jobs")
    .select("*")
    .eq("user_id", user.id)
    .neq("user_id", "d5cbc741-e8d9-43ee-9d90-32c409c3f40a") // exclude global automated bot
    .order("created_at", { ascending: false })
    .limit(50); // increased limit to show more history

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    jobId: row.job_id,
    clientName: row.client_name,
    googleAdsId: row.google_ads_id ?? "",
    dateRange: { start: row.date_start ?? "", end: row.date_end ?? "" },
    createdAt: row.created_at,
    status: (row.status as ReportHistoryEntry["status"]) ?? "pending",
    jobType: row.job_type ?? undefined,
    html: row.html_content ?? undefined,
  }));
}

/** Fetch all automated reports specifically assigned to the global bot user. */
export async function getAutomatedReports(): Promise<ReportHistoryEntry[]> {
  const { data, error } = await supabase
    .from("report_jobs")
    .select("*")
    .eq("user_id", "d5cbc741-e8d9-43ee-9d90-32c409c3f40a")
    .order("created_at", { ascending: false })
    .limit(75); // limit to recent 75 automated reports

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    jobId: row.job_id,
    clientName: row.client_name,
    googleAdsId: row.google_ads_id ?? "",
    dateRange: { start: row.date_start ?? "", end: row.date_end ?? "" },
    createdAt: row.created_at,
    status: (row.status as ReportHistoryEntry["status"]) ?? "pending",
    jobType: row.job_type ?? undefined,
    html: row.html_content ?? undefined,
  }));
}

/** Create a new pending report job in Supabase immediately when a report is kicked off. */
export async function createReport(entry: {
  jobId: string;
  userId: string;
  clientName: string;
  googleAdsId: string;
  jobType: string;
  dateRange: { start: string; end: string };
}): Promise<string | null> {
  const { data, error } = await supabase
    .from("report_jobs")
    .insert({
      job_id: entry.jobId,
      user_id: entry.userId,
      client_name: entry.clientName,
      google_ads_id: entry.googleAdsId,
      date_start: entry.dateRange.start,
      date_end: entry.dateRange.end,
      job_type: entry.jobType,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("Failed to create report job in Supabase:", error);
    return null;
  }
  return data.id;
}

/** Update an existing report job with its final status and HTML. */
export async function updateReport(
  jobId: string,
  update: { status: "complete" | "error"; html?: string }
): Promise<void> {
  await supabase
    .from("report_jobs")
    .update({
      status: update.status,
      html_content: update.html ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", jobId);
}

/** Delete a report job by its DB UUID. */
export async function deleteReport(id: string): Promise<void> {
  const { error } = await supabase.from("report_jobs").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete report from Supabase:", error);
    throw error;
  }
}
