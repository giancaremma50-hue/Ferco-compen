import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadErrorReportDetail, type ErrorReportDetail } from "./get-error-reports";
import type { Database } from "@/lib/supabase/database.types";

export type MyReportListItem = {
  id: string;
  code: string;
  title: string;
  status: Database["public"]["Enums"]["error_status"];
  createdAt: string;
};

/** RLS (error_reports_select) ya limita esto a `reporter_id = auth.uid()`. */
export async function getMyReports(): Promise<MyReportListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("error_reports")
    .select("id, code, title, status, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map((r) => ({ id: r.id, code: r.code, title: r.title, status: r.status, createdAt: r.created_at }));
}

export async function getMyReportDetail(id: string): Promise<ErrorReportDetail | null> {
  const supabase = await createClient();
  return loadErrorReportDetail(supabase, id);
}
