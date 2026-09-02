import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type ErrorReportRow = Tables<"error_reports"> & {
  reporter: { display_name: string; email: string } | null;
};
export type ErrorReportMessageRow = Tables<"error_report_messages"> & {
  author: { display_name: string } | null;
};

const REPORT_SELECT = "*, reporter:profiles!error_reports_reporter_id_fkey(display_name, email)";

/**
 * Las 4 funciones de abajo SIEMPRE filtran por organización, en la app:
 * la política RLS `error_reports_select`/`error_report_messages_select` es
 * `reporter_id = auth.uid() OR is_super_admin()` y `is_super_admin()` no
 * valida organización — un super admin de OTRA organización pasaría igual
 * esa condición. Mientras esa política no se corrija (fuera de alcance de
 * Fase 7, ver napkin.md), este filtro es la única barrera real contra fuga
 * entre tenants — por eso se repite en cada función a propósito, nunca se
 * omite "porque ya lo filtra el caller".
 */
export async function getErrorReportsInbox(organizationId: string): Promise<ErrorReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("error_reports")
    .select(REPORT_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return (data as ErrorReportRow[]) ?? [];
}

export async function getMyErrorReports(profileId: string, organizationId: string): Promise<ErrorReportRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("error_reports")
    .select(REPORT_SELECT)
    .eq("organization_id", organizationId)
    .eq("reporter_id", profileId)
    .order("created_at", { ascending: false });
  return (data as ErrorReportRow[]) ?? [];
}

export async function getErrorReport(id: string, organizationId: string): Promise<ErrorReportRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("error_reports")
    .select(REPORT_SELECT)
    .eq("id", id)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data as ErrorReportRow | null;
}

export async function getErrorReportMessages(reportId: string, organizationId: string): Promise<ErrorReportMessageRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("error_report_messages")
    .select("*, author:profiles!error_report_messages_author_id_fkey(display_name)")
    .eq("error_report_id", reportId)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  return (data as ErrorReportMessageRow[]) ?? [];
}
