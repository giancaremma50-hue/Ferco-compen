import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type ErrorSeverity = Database["public"]["Enums"]["error_severity"];
type ErrorStatus = Database["public"]["Enums"]["error_status"];

export type ErrorReportListItem = {
  id: string;
  code: string;
  title: string;
  severity: ErrorSeverity;
  status: ErrorStatus;
  createdAt: string;
  reporterId: string | null;
};

export type ErrorReportMessage = {
  id: string;
  body: string;
  createdAt: string;
  authorId: string | null;
  authorName: string | null;
};

export type ErrorReportDetail = {
  id: string;
  code: string;
  title: string;
  userMessage: string;
  technicalDetail: string | null;
  stack: string | null;
  url: string | null;
  userAgent: string | null;
  context: unknown;
  severity: ErrorSeverity;
  status: ErrorStatus;
  createdAt: string;
  resolvedAt: string | null;
  reporterId: string | null;
  reporterName: string | null;
  messages: ErrorReportMessage[];
};

/**
 * Lectura del super admin — RLS (error_reports_select) ya le deja ver todos
 * los reportes de su organización vía `is_super_admin()`, no hace falta
 * cliente admin.
 */
export async function getErrorReportsList(filters: {
  status?: ErrorStatus;
  severity?: ErrorSeverity;
}): Promise<ErrorReportListItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("error_reports")
    .select("id, code, title, severity, status, created_at, reporter_id")
    .order("created_at", { ascending: false })
    .limit(100);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.severity) query = query.eq("severity", filters.severity);

  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id,
    code: r.code,
    title: r.title,
    severity: r.severity,
    status: r.status,
    createdAt: r.created_at,
    reporterId: r.reporter_id,
  }));
}

export async function loadErrorReportDetail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<ErrorReportDetail | null> {
  // Ninguna de las dos depende del resultado de la otra (ambas filtran solo
  // por `id`) — van en paralelo. Si el reporte no existe, el resultado de
  // los mensajes simplemente se descarta más abajo.
  const [{ data: report }, { data: messages }] = await Promise.all([
    supabase
      .from("error_reports")
      .select(
        "id, code, title, user_message, technical_detail, stack, url, user_agent, context, severity, status, created_at, resolved_at, reporter_id",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("error_report_messages")
      .select("id, body, created_at, author_id")
      .eq("error_report_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (!report) return null;

  const authorIds = Array.from(
    new Set([report.reporter_id, ...(messages ?? []).map((m) => m.author_id)].filter((v): v is string => !!v)),
  );
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, display_name").in("id", authorIds)
    : { data: [] as { id: string; display_name: string }[] };
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.display_name]));

  return {
    id: report.id,
    code: report.code,
    title: report.title,
    userMessage: report.user_message,
    technicalDetail: report.technical_detail,
    stack: report.stack,
    url: report.url,
    userAgent: report.user_agent,
    context: report.context,
    severity: report.severity,
    status: report.status,
    createdAt: report.created_at,
    resolvedAt: report.resolved_at,
    reporterId: report.reporter_id,
    reporterName: report.reporter_id ? (nameById.get(report.reporter_id) ?? null) : null,
    messages: (messages ?? []).map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.created_at,
      authorId: m.author_id,
      authorName: m.author_id ? (nameById.get(m.author_id) ?? null) : null,
    })),
  };
}

export async function getErrorReportDetail(id: string): Promise<ErrorReportDetail | null> {
  const supabase = await createClient();
  return loadErrorReportDetail(supabase, id);
}
