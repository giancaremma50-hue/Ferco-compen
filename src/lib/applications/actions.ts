"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyBestEffort, getEmailContext } from "@/lib/notifications/notify";
import { zodFieldError } from "@/lib/forms/zod-error";
import { sendEmail } from "@/lib/email/send-email";
import { CambioEtapaEmail } from "@/emails/cambio-etapa";
import { MovimientoReferidoEmail } from "@/emails/movimiento-referido";
import { MensajeCandidatoEmail } from "@/emails/mensaje-candidato";
import { canDecideApplication, canWriteApplication } from "./permissions";
import { isProfileAssignable } from "./get-applications";
import { getDrawerData, type DrawerData } from "./get-drawer-data";
import { getSignedCvUrl } from "@/lib/candidates/get-signed-cv-url";
import { NoteSchema, RejectSchema, RATING_MAX, TaskSchema, SendMessageSchema } from "./schema";

export type ApplicationActionResult = { error?: string; success?: string; field?: string };

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
  if (!parsed.success) return zodFieldError(parsed.error, "Revisa la nota.");

  const supabase = await createClient();

  // RLS solo exige can_access_job, que también deja pasar a un miembro de
  // SOLO LECTURA — sin este chequeo, "solo lectura" podría escribir notas.
  const noteJobId = await requireApplicationJobId(supabase, applicationId);
  if (!noteJobId) return { error: "No se encontró la postulación." };
  if (!(await canWriteApplication(profile.role, profile.id, noteJobId))) {
    return { error: "Tu perfil solo puede leer esta postulación." };
  }
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
  if (!(await canWriteApplication(profile.role, profile.id, jobId))) {
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
  if (!parsed.success) return zodFieldError(parsed.error, "Elige un motivo.");

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

export async function addTask(
  applicationId: string,
  _prevState: ApplicationActionResult | undefined,
  formData: FormData,
): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  const parsed = TaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa la tarea." };

  const supabase = await createClient();

  const taskJobId = await requireApplicationJobId(supabase, applicationId);
  if (!taskJobId) return { error: "No se encontró la postulación." };
  if (!(await canWriteApplication(profile.role, profile.id, taskJobId))) {
    return { error: "Tu perfil solo puede leer esta postulación." };
  }

  // El <select> del formulario ya solo lista gente con acceso a la
  // vacante, pero eso es solo la UI — el cliente nunca es fuente de
  // verdad. Sin esto, un POST directo podría asignar la tarea a alguien
  // sin ninguna relación con la vacante (ni siquiera podría verla luego,
  // candidate_tasks_select exige can_access_job).
  if (parsed.data.assigned_to) {
    if (!(await isProfileAssignable(parsed.data.assigned_to, taskJobId, profile.organization_id))) {
      return { error: "Esa persona no tiene acceso a esta vacante." };
    }
  }

  const { error } = await supabase.from("candidate_tasks").insert({
    organization_id: profile.organization_id,
    application_id: applicationId,
    description: parsed.data.description,
    assigned_to: parsed.data.assigned_to ?? null,
    due_date: parsed.data.due_date ?? null,
    created_by: profile.id,
  });
  if (error) return { error: "No se pudo agregar la tarea." };

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Tarea agregada" };
}

export async function toggleTask(taskId: string, applicationId: string, isDone: boolean): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const jobId = await requireApplicationJobId(supabase, applicationId);
  if (!jobId) return { error: "No se encontró la postulación." };
  if (!(await canWriteApplication(profile.role, profile.id, jobId))) {
    return { error: "Tu perfil solo puede leer esta postulación." };
  }
  // applicationId además de taskId en el WHERE: taskId ya es suficiente
  // para que RLS decida el permiso real, pero así un id desincronizado no
  // revalida silenciosamente la página de OTRA postulación por error.
  // `.select()` + 0 filas = RLS la negó (candidate_tasks_update solo deja
   // al creador, al asignado y a admin+) — sin esto la action reportaba
   // "Tarea completada" con éxito habiendo cambiado nada.
  const { data: updated, error } = await supabase
    .from("candidate_tasks")
    .update({ is_done: isDone, completed_at: isDone ? new Date().toISOString() : null })
    .eq("id", taskId)
    .eq("application_id", applicationId)
    .select("id");
  if (error || !updated || updated.length === 0) return { error: "No se pudo actualizar la tarea." };

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: isDone ? "Tarea completada" : "Tarea reabierta" };
}

export async function sendCandidateMessage(
  applicationId: string,
  _prevState: ApplicationActionResult | undefined,
  formData: FormData,
): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  const parsed = SendMessageSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa el mensaje." };

  const supabase = await createClient();

  // El destinatario sale de la fila, nunca de un campo del formulario — si
  // el "to" viniera del cliente, cualquiera con acceso a la vacante podría
  // mandar un correo con remitente de esta plataforma a cualquier dirección.
  // getEmailContext() no depende de esta fila ni del permiso — va en
  // paralelo en vez de esperar a que ambos terminen en serie.
  const [{ data: application }, { platformName, siteUrl }] = await Promise.all([
    supabase
      .from("applications")
      .select("job_id, organization_id, candidates(full_name, email)")
      .eq("id", applicationId)
      .single(),
    getEmailContext(),
  ]);
  if (!application) return { error: "No se encontró la postulación." };
  if (!(await canDecideApplication(profile.role, profile.id, application.job_id))) {
    return { error: "Tu perfil no puede enviar mensajes en esta vacante." };
  }
  const { error: sendError } = await sendEmail({
    to: application.candidates!.email,
    subject: parsed.data.subject,
    react: MensajeCandidatoEmail({
      platformName,
      privacyUrl: `${siteUrl}/privacidad`,
      candidateName: application.candidates!.full_name,
      body: parsed.data.body,
    }),
  });
  if (sendError) return { error: sendError };

  await supabase.from("application_events").insert({
    organization_id: application.organization_id,
    application_id: applicationId,
    type: "correo_enviado",
    actor_id: profile.id,
    payload: { subject: parsed.data.subject },
  });

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Mensaje enviado" };
}

export async function deleteTask(taskId: string, applicationId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const jobId = await requireApplicationJobId(supabase, applicationId);
  if (!jobId) throw new Error("No se encontró la postulación.");
  if (!(await canWriteApplication(profile.role, profile.id, jobId))) {
    throw new Error("Tu perfil solo puede leer esta postulación.");
  }
  const { data: deleted, error } = await supabase
    .from("candidate_tasks")
    .delete()
    .eq("id", taskId)
    .eq("application_id", applicationId)
    .select("id");
  if (error || !deleted || deleted.length === 0) throw new Error("No se pudo eliminar la tarea.");
  revalidatePath(`/postulaciones/${applicationId}`);
}

/**
 * Todo lo que el drawer de candidato necesita, en una sola llamada — se
 * pide al abrir el drawer desde el pipeline (en vez de navegar a
 * /postulaciones/[id], que sigue existiendo como página completa para
 * enlaces directos, ej. desde una notificación).
 */
export async function getApplicationDrawerData(applicationId: string): Promise<DrawerData | null> {
  const profile = await requireProfile();
  return getDrawerData(applicationId, { id: profile.id, role: profile.role, organizationId: profile.organization_id });
}

/**
 * Se pide al momento del clic, no cuando se abre el drawer — la URL firmada
 * vale 60s, y el drawer puede quedar abierto mucho más que eso antes de que
 * alguien haga clic en "Ver CV".
 */
export async function getCvViewUrl(cvFilePath: string): Promise<{ url: string | null }> {
  await requireProfile();
  return { url: await getSignedCvUrl(cvFilePath) };
}
