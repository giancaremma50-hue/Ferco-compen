"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getProfile, requireProfile, requireSuperAdmin } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { getOrganization } from "@/lib/organizations/get-organization";
import { notify, notifyBestEffort, getEmailContext } from "@/lib/notifications/notify";
import { buildFingerprint } from "./fingerprint";
import { CreateReportSchema, PostMessageSchema } from "./report-schema";
import { STATUS_OPTIONS, SEVERITY_OPTIONS } from "./status-labels";
import { AppError } from "./app-error";
import { ReporteErrorEmail } from "@/emails/reporte-error";
import type { Database } from "@/lib/supabase/database.types";

export type ReportActionResult = { error?: string; success?: string; code?: string };

/**
 * Best-effort: avisa a todos los super admin de la organización que hay
 * actividad nueva en un reporte (uno recién creado, o un mensaje que
 * escribió el propio reportero). Cliente admin porque hace falta listar a
 * TODOS los super admin, no solo los que el actor de turno pueda ver.
 */
function notifySuperAdmins(organizationId: string, reportId: string, reportCode: string, summary: string): void {
  notifyBestEffort(async () => {
    const admin = createAdminClient();
    const { data: superAdmins } = await admin
      .from("profiles")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("role", "super_admin");
    if (!superAdmins || superAdmins.length === 0) return;

    const { platformName, siteUrl } = await getEmailContext();
    const reportUrl = `${siteUrl}/configuracion/errores/${reportId}`;

    await Promise.all(
      superAdmins.map((sa) =>
        notify({
          organizationId,
          recipientId: sa.id,
          type: "respuesta_reporte_error",
          title: `Reporte ${reportCode}`,
          body: summary,
          url: `/configuracion/errores/${reportId}`,
          entityType: "error_report",
          entityId: reportId,
          email: {
            subject: `Actividad en el reporte ${reportCode}`,
            react: ReporteErrorEmail({ platformName, reportCode, summary, reportUrl }),
          },
        }),
      ),
    );
  });
}

/** Best-effort: avisa al reportero que el super admin respondió o cerró su reporte. */
function notifyReporter(organizationId: string, reporterId: string, reportId: string, reportCode: string, summary: string): void {
  notifyBestEffort(async () => {
    const { platformName, siteUrl } = await getEmailContext();
    const reportUrl = `${siteUrl}/mis-reportes/${reportId}`;
    await notify({
      organizationId,
      recipientId: reporterId,
      type: "respuesta_reporte_error",
      title: `Reporte ${reportCode}`,
      body: summary,
      url: `/mis-reportes/${reportId}`,
      entityType: "error_report",
      entityId: reportId,
      email: {
        subject: `Actividad en tu reporte ${reportCode}`,
        react: ReporteErrorEmail({ platformName, reportCode, summary, reportUrl }),
      },
    });
  });
}

export async function createErrorReport(
  _prevState: ReportActionResult | undefined,
  formData: FormData,
): Promise<ReportActionResult> {
  // Este formulario lo puede disparar cualquier visitante sin sesión (el
  // diálogo de reporte vive en error.tsx, montado en toda la app, y en
  // /auth/auth-error que por definición no tiene sesión) — mismo riesgo de
  // abuso que /api/postular, mismo límite.
  const forwardedFor = (await headers()).get("x-forwarded-for");
  const ip = forwardedFor?.split(",").map((p) => p.trim()).filter(Boolean).pop() ?? "desconocida";
  if (!checkRateLimit(`reporte-error:${ip}`, { max: 5, windowMs: 60_000 })) {
    return { error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo." };
  }

  const parsed = CreateReportSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa el mensaje." };
  }

  // Sin requireProfile(): un fallo de login puede llegar aquí sin fila en
  // profiles todavía (ver napkin) — el reporte debe poder crearse igual,
  // solo que sin reporter_id.
  const profile = await getProfile();

  // El fingerprint agrupa por la FIRMA TÉCNICA del problema (código de
  // catálogo + mensaje técnico/stack), nunca por lo que el usuario escribió
  // en sus propias palabras — dos personas con el mismo bug casi nunca
  // describen "qué intentaban hacer" con el mismo texto.
  const fingerprint = buildFingerprint(
    parsed.data.code ?? "desconocido",
    parsed.data.technical_detail ?? parsed.data.stack ?? parsed.data.code ?? "sin_detalle",
  );
  const row = {
    title: parsed.data.title || "Reporte de error",
    user_message: parsed.data.user_message,
    technical_detail: parsed.data.technical_detail ?? null,
    stack: parsed.data.stack ?? null,
    url: parsed.data.url ?? null,
    user_agent: parsed.data.user_agent ?? null,
    context: { code: parsed.data.code ?? null },
    fingerprint,
  };

  let organizationId: string;
  let reportId: string;
  let code: string;

  if (profile) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("error_reports")
      .insert({ ...row, organization_id: profile.organization_id, reporter_id: profile.id })
      .select("id, code")
      .single();
    if (error || !data) return { error: "No se pudo enviar el reporte. Inténtalo de nuevo." };
    organizationId = profile.organization_id;
    reportId = data.id;
    code = data.code;
  } else {
    const organization = await getOrganization();
    if (!organization) {
      // No debería pasar nunca — "principal" es la única organización y es
      // de lectura pública — pero si pasa, no hay reportero al que
      // atribuirlo ni forma de que el usuario vuelva a intentarlo con
      // contexto distinto. AppError deja el código de catálogo en el log
      // del servidor en vez de un Error genérico sin pistas.
      console.error(new AppError("sin_organizacion", "getOrganization() devolvió null al crear un reporte anónimo"));
      return { error: "No se pudo enviar el reporte. Inténtalo de nuevo." };
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("error_reports")
      .insert({ ...row, organization_id: organization.id, reporter_id: null })
      .select("id, code")
      .single();
    if (error || !data) return { error: "No se pudo enviar el reporte. Inténtalo de nuevo." };
    organizationId = organization.id;
    reportId = data.id;
    code = data.code;
  }

  notifySuperAdmins(organizationId, reportId, code, `Nuevo reporte: "${row.title}".`);

  return { success: "Reporte enviado", code };
}

export async function postErrorMessage(
  reportId: string,
  _prevState: ReportActionResult | undefined,
  formData: FormData,
): Promise<ReportActionResult> {
  const profile = await requireProfile();
  const parsed = PostMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa el mensaje." };

  const supabase = await createClient();

  // RLS (error_report_messages_select) ya deja ver el reporte padre solo si
  // el actor es el reportero o es super admin — si esto vuelve null, no
  // tiene acceso y el insert de abajo tampoco lo tendría.
  const { data: report } = await supabase
    .from("error_reports")
    .select("organization_id, reporter_id, code")
    .eq("id", reportId)
    .single();
  if (!report) return { error: "No se encontró el reporte." };

  const { error } = await supabase.from("error_report_messages").insert({
    organization_id: report.organization_id,
    error_report_id: reportId,
    author_id: profile.id,
    body: parsed.data.body,
  });
  if (error) return { error: "No se pudo enviar el mensaje." };

  if (profile.id === report.reporter_id) {
    notifySuperAdmins(report.organization_id, reportId, report.code, "El reportero respondió en el hilo.");
  } else if (report.reporter_id) {
    notifyReporter(report.organization_id, report.reporter_id, reportId, report.code, "El soporte respondió tu reporte.");
  }

  revalidatePath(`/configuracion/errores/${reportId}`);
  revalidatePath(`/mis-reportes/${reportId}`);
  return { success: "Mensaje enviado" };
}

type ErrorStatus = Database["public"]["Enums"]["error_status"];
type ErrorSeverity = Database["public"]["Enums"]["error_severity"];

const StatusSchema = z.enum(STATUS_OPTIONS as [ErrorStatus, ...ErrorStatus[]]);

export async function updateErrorReportStatus(reportId: string, status: string): Promise<ReportActionResult> {
  await requireSuperAdmin();
  const parsed = StatusSchema.safeParse(status);
  if (!parsed.success) return { error: "Estado inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("error_reports")
    .update({ status: parsed.data, resolved_at: parsed.data === "resuelto" ? new Date().toISOString() : null })
    .eq("id", reportId)
    .select("organization_id, reporter_id, code")
    .single();
  if (error || !data) return { error: "No se pudo actualizar el estado." };

  if (parsed.data === "resuelto" && data.reporter_id) {
    notifyReporter(data.organization_id, data.reporter_id, reportId, data.code, "Tu reporte fue marcado como resuelto.");
  }

  revalidatePath(`/configuracion/errores/${reportId}`);
  revalidatePath("/configuracion/errores");
  return { success: "Estado actualizado" };
}

const SeveritySchema = z.enum(SEVERITY_OPTIONS as [ErrorSeverity, ...ErrorSeverity[]]);

export async function updateErrorReportSeverity(reportId: string, severity: string): Promise<ReportActionResult> {
  await requireSuperAdmin();
  const parsed = SeveritySchema.safeParse(severity);
  if (!parsed.success) return { error: "Severidad inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("error_reports").update({ severity: parsed.data }).eq("id", reportId);
  if (error) return { error: "No se pudo actualizar la severidad." };

  revalidatePath(`/configuracion/errores/${reportId}`);
  revalidatePath("/configuracion/errores");
  return { success: "Severidad actualizada" };
}
