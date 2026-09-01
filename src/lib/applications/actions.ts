"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyBestEffort, getEmailContext } from "@/lib/notifications/notify";
import { CambioEtapaEmail } from "@/emails/cambio-etapa";
import { MovimientoReferidoEmail } from "@/emails/movimiento-referido";
import { canDecideApplication, canRateApplication } from "./permissions";
import { NoteSchema, RejectSchema, RATING_MAX } from "./schema";

export type ApplicationActionResult = { error?: string; success?: string };

/** Repetido en setRating/rejectApplication/hireApplication/reopenApplication — un solo lugar para no desincronizar el shape de la query. */
async function requireApplicationJobId(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
): Promise<string | null> {
  const { data } = await supabase.from("applications").select("job_id").eq("id", applicationId).single();
  return data?.job_id ?? null;
}

/**
 * Se invoca siempre envuelta en notifyBestEffort() — corre con after(),
 * después de responder. Cliente admin porque la notificación es para OTRA
 * persona (dueño de la vacante o quien refirió al candidato), no depende
 * de lo que el actor que movió la tarjeta pueda ver por RLS.
 */
async function notifyStageChange(
  applicationId: string,
  jobId: string,
  candidateId: string,
  toStageId: string,
  moverId: string,
  organizationId: string,
): Promise<void> {
  const admin = createAdminClient();
  const [{ data: job }, { data: candidate }, { data: stage }] = await Promise.all([
    admin.from("jobs").select("title, owner_id, requested_by").eq("id", jobId).single(),
    admin.from("candidates").select("full_name, referred_by").eq("id", candidateId).single(),
    admin.from("job_stages").select("name").eq("id", toStageId).single(),
  ]);
  if (!job || !candidate || !stage) return;

  const ownerId = job.owner_id ?? job.requested_by;
  const referrerId =
    candidate.referred_by && candidate.referred_by !== ownerId ? candidate.referred_by : null;
  if ((!ownerId || ownerId === moverId) && (!referrerId || referrerId === moverId)) return;

  const { platformName, siteUrl } = await getEmailContext();
  const applicationUrl = `${siteUrl}/postulaciones/${applicationId}`;

  await Promise.all([
    ownerId && ownerId !== moverId
      ? notify({
          organizationId,
          recipientId: ownerId,
          type: "cambio_etapa",
          title: "Cambio de etapa",
          body: `${candidate.full_name} (${job.title}) pasó a la etapa "${stage.name}".`,
          url: `/postulaciones/${applicationId}`,
          entityType: "application",
          entityId: applicationId,
          email: {
            subject: "Cambio de etapa",
            react: CambioEtapaEmail({
              platformName,
              candidateName: candidate.full_name,
              jobTitle: job.title,
              stageName: stage.name,
              applicationUrl,
            }),
          },
        })
      : Promise.resolve(),
    referrerId && referrerId !== moverId
      ? notify({
          organizationId,
          recipientId: referrerId,
          type: "movimiento_referido",
          title: "Tu referido avanzó",
          body: `${candidate.full_name}, a quien referiste para "${job.title}", ahora está en la etapa "${stage.name}".`,
          url: `/postulaciones/${applicationId}`,
          entityType: "application",
          entityId: applicationId,
          email: {
            subject: "Tu referido avanzó",
            react: MovimientoReferidoEmail({
              platformName,
              candidateName: candidate.full_name,
              jobTitle: job.title,
              stageName: stage.name,
              applicationUrl,
            }),
          },
        })
      : Promise.resolve(),
  ]);
}

export async function moveApplicationStage(
  applicationId: string,
  fromStageId: string,
  toStageId: string,
): Promise<ApplicationActionResult> {
  const profile = await requireProfile();

  const supabase = await createClient();

  // Una Server Action es un endpoint de red, no solo lo que el kanban
  // manda al arrastrar: sin este chequeo, nada impide pasar el id de una
  // etapa de OTRA vacante — job_stages.id es una PK global, no está
  // particionada por vacante. Confirmar que ambas etapas pertenecen a la
  // misma vacante que esta postulación antes de tocar la fila.
  const { data: application } = await supabase
    .from("applications")
    .select("job_id, candidate_id")
    .eq("id", applicationId)
    .single();
  if (!application) return { error: "No se encontró la postulación." };

  // Acceso fino por job_collaborators (AGENTS.md) — un `colaborador` solo
  // mueve etapa si es approver/owner de ESTA vacante, no por rol global.
  // ANTES del atajo "misma etapa": si no, un actor sin permiso alguno
  // recibe "Sin cambios" sin que este chequeo llegue a correr nunca.
  if (!(await canDecideApplication(profile.role, profile.id, application.job_id))) {
    return { error: "Tu perfil no puede mover postulaciones en esta vacante." };
  }

  if (fromStageId === toStageId) return { success: "Sin cambios" };

  const { data: validStages } = await supabase
    .from("job_stages")
    .select("id")
    .eq("job_id", application.job_id)
    .in("id", [fromStageId, toStageId]);
  if (!validStages || validStages.length !== 2) {
    // Puede ser que la etapa sea de otra vacante, o que RLS haya escondido
    // job_stages porque este actor no tiene acceso a esa vacante — no hay
    // forma barata de distinguir los dos casos, y en ambos la acción debe
    // bloquearse igual, así que el mensaje cubre ambos con honestidad.
    return { error: "No se pudo mover: verifica que la etapa y el acceso a esta vacante sean correctos." };
  }

  // Compare-and-swap: si alguien más ya la movió desde que esta pantalla
  // cargó, `fromStageId` ya no coincide con la fila real y el UPDATE no
  // afecta nada — evita que dos arrastres simultáneos se pisen en silencio
  // (mismo patrón que las transiciones de estado de vacantes en Fase 4).
  const { data, error } = await supabase
    .from("applications")
    .update({ stage_id: toStageId, stage_changed_at: new Date().toISOString(), stage_changed_by: profile.id })
    .eq("id", applicationId)
    .eq("stage_id", fromStageId)
    .select("id, organization_id")
    .single();

  if (error || !data) {
    return { error: "Alguien más ya movió esta postulación. Actualiza la página." };
  }

  await supabase.from("application_events").insert({
    organization_id: data.organization_id,
    application_id: applicationId,
    type: "etapa_cambiada",
    actor_id: profile.id,
    payload: { from: fromStageId, to: toStageId },
  });

  notifyBestEffort(() =>
    notifyStageChange(applicationId, application.job_id, application.candidate_id, toStageId, profile.id, data.organization_id),
  );

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Etapa actualizada" };
}

export async function addNote(
  applicationId: string,
  _prevState: ApplicationActionResult | undefined,
  formData: FormData,
): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  const parsed = NoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa la nota." };

  const supabase = await createClient();
  const { data: note, error } = await supabase
    .from("notes")
    .insert({
      organization_id: profile.organization_id,
      application_id: applicationId,
      author_id: profile.id,
      body: parsed.data.body,
      is_private: parsed.data.is_private,
    })
    .select("id")
    .single();

  if (error || !note) return { error: "No se pudo guardar la nota." };

  await supabase.from("application_events").insert({
    organization_id: profile.organization_id,
    application_id: applicationId,
    type: "nota_agregada",
    actor_id: profile.id,
    payload: { is_private: parsed.data.is_private },
  });

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Nota agregada" };
}

export async function setRating(applicationId: string, rating: number): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  const parsed = z.number().int().min(0).max(RATING_MAX).safeParse(rating);
  if (!parsed.success) return { error: "Calificación inválida." };

  const supabase = await createClient();

  const jobId = await requireApplicationJobId(supabase, applicationId);
  if (!jobId) return { error: "No se encontró la postulación." };
  if (!(await canRateApplication(profile.role, profile.id, jobId))) {
    return { error: "Tu perfil no puede calificar en esta vacante." };
  }

  const value = parsed.data === 0 ? null : parsed.data;
  const { data, error } = await supabase
    .from("applications")
    .update({ rating: value })
    .eq("id", applicationId)
    .select("organization_id")
    .single();

  if (error || !data) return { error: "No se pudo guardar la calificación." };

  await supabase.from("application_events").insert({
    organization_id: data.organization_id,
    application_id: applicationId,
    type: "calificacion_cambiada",
    actor_id: profile.id,
    payload: { rating: value },
  });

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Calificación guardada" };
}

export async function rejectApplication(
  applicationId: string,
  _prevState: ApplicationActionResult | undefined,
  formData: FormData,
): Promise<ApplicationActionResult> {
  const profile = await requireProfile();

  const parsed = RejectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Elige un motivo." };

  const supabase = await createClient();

  const jobId = await requireApplicationJobId(supabase, applicationId);
  if (!jobId) return { error: "No se encontró la postulación." };
  if (!(await canDecideApplication(profile.role, profile.id, jobId))) {
    return { error: "Tu perfil no puede rechazar postulaciones en esta vacante." };
  }

  const { data, error } = await supabase
    .from("applications")
    .update({ status: "rechazada", rejection_reason_id: parsed.data.rejection_reason_id })
    .eq("id", applicationId)
    .eq("status", "activa")
    .select("organization_id")
    .single();

  if (error || !data) return { error: "Esta postulación ya no está activa." };

  await supabase.from("application_events").insert({
    organization_id: data.organization_id,
    application_id: applicationId,
    type: "rechazada",
    actor_id: profile.id,
    payload: { rejection_reason_id: parsed.data.rejection_reason_id },
  });

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Postulación rechazada" };
}

export async function hireApplication(applicationId: string): Promise<ApplicationActionResult> {
  const profile = await requireProfile();

  const supabase = await createClient();

  const jobId = await requireApplicationJobId(supabase, applicationId);
  if (!jobId) return { error: "No se encontró la postulación." };
  if (!(await canDecideApplication(profile.role, profile.id, jobId))) {
    return { error: "Tu perfil no puede contratar en esta vacante." };
  }

  const { data, error } = await supabase
    .from("applications")
    .update({ status: "contratada" })
    .eq("id", applicationId)
    .eq("status", "activa")
    .select("id")
    .single();

  if (error || !data) return { error: "Esta postulación ya no está activa." };

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Candidato contratado" };
}

export async function reopenApplication(applicationId: string): Promise<ApplicationActionResult> {
  const profile = await requireProfile();

  const supabase = await createClient();

  const jobId = await requireApplicationJobId(supabase, applicationId);
  if (!jobId) return { error: "No se encontró la postulación." };
  if (!(await canDecideApplication(profile.role, profile.id, jobId))) {
    return { error: "Tu perfil no puede reabrir postulaciones en esta vacante." };
  }

  const { data, error } = await supabase
    .from("applications")
    .update({ status: "activa", rejection_reason_id: null })
    .eq("id", applicationId)
    .eq("status", "rechazada")
    .select("id")
    .single();

  if (error || !data) return { error: "Esta postulación no está rechazada." };

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Postulación reabierta" };
}
