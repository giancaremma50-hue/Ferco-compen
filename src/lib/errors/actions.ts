"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyBestEffort } from "@/lib/notifications/notify";
import { ERROR_CATALOG } from "./catalog";
import { ReportErrorSchema, ReplySchema } from "./schema";
import type { Database } from "@/lib/supabase/database.types";

export type ErrorActionResult = { error?: string; success?: string; code?: string };

type ErrorStatus = Database["public"]["Enums"]["error_status"];

// Los campos de contexto se auto-capturan del navegador (URL, user agent,
// mensaje/digest de la excepción) — pueden ser más largos que el límite de
// ReportErrorSchema (pensado para lo que escribe una persona). Se recortan
// ANTES de validar para que un error real y largo nunca bloquee el único
// reporte que existe para contarlo.
function truncate(value: string | undefined, max: number): string | undefined {
  return value === undefined ? undefined : value.slice(0, max);
}

/**
 * Notifica a todos los super admin de la organización — no hay un
 * "asignado" por defecto, así que cualquiera puede tomar el reporte.
 * Cliente admin porque lee perfiles de OTRAS personas (los super admin),
 * no del actor que dispara el evento.
 */
async function notifySuperAdmins(
  organizationId: string,
  excludeProfileId: string,
  title: string,
  body: string,
  reportId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: superAdmins } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("role", "super_admin")
    .eq("is_active", true)
    .neq("id", excludeProfileId);

  await Promise.all(
    (superAdmins ?? []).map((sa) =>
      notify({
        organizationId,
        recipientId: sa.id,
        type: "respuesta_reporte_error",
        title,
        body,
        url: `/configuracion/errores?id=${reportId}`,
        entityType: "error_report",
        entityId: reportId,
      }),
    ),
  );
}

export async function createErrorReport(
  context: { motivo?: string; titulo?: string; url?: string; user_agent?: string; technical_detail?: string },
  _prevState: ErrorActionResult | undefined,
  formData: FormData,
): Promise<ErrorActionResult> {
  const profile = await requireProfile();

  // motivo llega del cliente (query string / prop) sin garantía de que sea
  // una clave real del catálogo — no se guarda tal cual para no meter un
  // valor arbitrario e inconsistente con lo que el super admin ve mostrado.
  const motivo = context.motivo && context.motivo in ERROR_CATALOG ? context.motivo : "desconocido";

  const parsed = ReportErrorSchema.safeParse({
    motivo,
    titulo: context.titulo,
    url: truncate(context.url, 500),
    user_agent: truncate(context.user_agent, 300),
    technical_detail: truncate(context.technical_detail, 2000),
    user_message: formData.get("user_message"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa el mensaje." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("error_reports")
    .insert({
      organization_id: profile.organization_id,
      reporter_id: profile.id,
      title: parsed.data.titulo || "Algo se rompió",
      user_message: parsed.data.user_message,
      url: parsed.data.url ?? null,
      user_agent: parsed.data.user_agent ?? null,
      technical_detail: parsed.data.technical_detail ?? null,
      context: { motivo },
    })
    .select("id, code")
    .single();

  if (error || !data) return { error: "No se pudo enviar el reporte. Intenta de nuevo." };

  notifyBestEffort(() =>
    notifySuperAdmins(
      profile.organization_id,
      profile.id,
      `Nuevo reporte — ${data.code}`,
      `${profile.display_name}: «${parsed.data.user_message.slice(0, 140)}»`,
      data.id,
    ),
  );

  return { success: `Reporte enviado. Código ${data.code}.`, code: data.code };
}

export async function replyToErrorReport(
  reportId: string,
  _prevState: ErrorActionResult | undefined,
  formData: FormData,
): Promise<ErrorActionResult> {
  const profile = await requireProfile();
  const parsed = ReplySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa el mensaje." };

  const supabase = await createClient();
  // organization_id explícito: la política de error_reports no valida
  // organización del lado de is_super_admin() (ver get-error-reports.ts) —
  // sin este filtro, un super admin de otra organización podría responder
  // en un reporte ajeno.
  const { data: report } = await supabase
    .from("error_reports")
    .select("id, organization_id, reporter_id")
    .eq("id", reportId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (!report) return { error: "No se encontró el reporte." };

  const { error } = await supabase.from("error_report_messages").insert({
    organization_id: report.organization_id,
    error_report_id: reportId,
    author_id: profile.id,
    body: parsed.data.body,
  });
  if (error) return { error: "No se pudo enviar la respuesta." };

  const isSuperAdmin = profile.role === "super_admin";
  notifyBestEffort(async () => {
    // Un super admin respondiéndose a sí mismo (reporte propio) no
    // notifica a nadie — early return en vez de un if/else anidado para
    // que este caso quede explícito, no implícito en la rama que falta.
    if (isSuperAdmin && (!report.reporter_id || report.reporter_id === profile.id)) return;

    if (isSuperAdmin) {
      await notify({
        organizationId: report.organization_id,
        recipientId: report.reporter_id!,
        type: "respuesta_reporte_error",
        title: "Soporte te respondió",
        body: parsed.data.body.slice(0, 140),
        url: `/mi-cuenta/reportes/${reportId}`,
        entityType: "error_report",
        entityId: reportId,
      });
      return;
    }

    await notifySuperAdmins(
      report.organization_id,
      profile.id,
      "Nueva respuesta en un reporte",
      `${profile.display_name}: «${parsed.data.body.slice(0, 140)}»`,
      reportId,
    );
  });

  revalidatePath(`/configuracion/errores`);
  revalidatePath(`/mi-cuenta/reportes/${reportId}`);
  return { success: "Respuesta enviada" };
}

export async function updateErrorReportStatus(
  reportId: string,
  previousStatus: ErrorStatus,
  status: ErrorStatus,
): Promise<ErrorActionResult> {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") return { error: "Tu perfil no puede cambiar el estado de un reporte." };

  const supabase = await createClient();
  // Compare-and-swap (mismo patrón que vacantes/postulaciones): si otro
  // super admin ya cambió el estado desde que esta pantalla cargó,
  // previousStatus ya no coincide y el UPDATE no afecta ninguna fila —
  // evita que dos clics casi simultáneos se pisen en silencio.
  const { data, error } = await supabase
    .from("error_reports")
    .update({ status, resolved_at: status === "resuelto" ? new Date().toISOString() : null })
    .eq("id", reportId)
    .eq("organization_id", profile.organization_id)
    .eq("status", previousStatus)
    .select("id")
    .single();
  if (error || !data) return { error: "Alguien más ya cambió este reporte. Actualiza la página." };

  revalidatePath("/configuracion/errores");
  return { success: "Estado actualizado" };
}
