"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth/dal";
import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { JobFormSchema } from "./schema";
import type { JobStatus, JobFormValues } from "./schema";
import { materializeJobStages } from "./materialize-stages";
import { generateJobSlug } from "./slug";
import { TERMINAL_JOB_STATUSES } from "./permissions";
import { findOrCreateCandidate, createApplicationForCandidate } from "./create-application";
import { notify, notifyBestEffort, getEmailContext } from "@/lib/notifications/notify";
import { VacantePendienteAprobacionEmail } from "@/emails/vacante-pendiente-aprobacion";
import { NuevaPostulacionEmail } from "@/emails/nueva-postulacion";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

export type JobActionResult = { error?: string; success?: string };

/**
 * El <select> del formulario solo ofrece departamentos de la propia
 * organización, pero una Server Action es un endpoint de red: nada impide
 * una llamada fabricada a mano con el id de un departamento de otra
 * organización (la FK de la columna solo exige que la fila exista, no que
 * coincida con la organización del actor).
 */
async function assertValidDepartment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  departmentId: string | undefined,
): Promise<string | null> {
  if (!departmentId) return null;
  const { data } = await supabase
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data ? null : "Ese departamento no es válido.";
}

/**
 * Los campos opcionales llegan como `undefined` cuando el formulario los
 * deja vacíos (ver optionalUuid/optionalNumber en schema.ts). Un `.update()`
 * de Supabase serializa el body a JSON antes de mandarlo, y JSON.stringify
 * omite las claves `undefined` — así que pasar `parsed.data` tal cual nunca
 * podría *borrar* un valor ya guardado, solo dejarlo intacto por accidente.
 * Aquí se normalizan a `null` explícito para que limpiar un campo sí limpie.
 */
function toJobRow(values: JobFormValues) {
  return {
    ...values,
    department_id: values.department_id ?? null,
    salary_min: values.salary_min ?? null,
    salary_max: values.salary_max ?? null,
  };
}

export async function createJob(
  _prevState: JobActionResult | undefined,
  formData: FormData,
): Promise<JobActionResult> {
  const profile = await requireProfile();
  if (profile.role === "colaborador") {
    return { error: "Tu perfil no puede solicitar vacantes." };
  }

  const parsed = JobFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos del formulario." };
  }

  const supabase = await createClient();

  const departmentError = await assertValidDepartment(supabase, profile.organization_id, parsed.data.department_id);
  if (departmentError) return { error: departmentError };

  // Toda vacante nace en "borrador" — RLS solo permite a quien no es admin
  // editar su propia fila mientras está en ese estado; enviarla a aprobación
  // es un paso explícito (submitForApproval), no algo que se decida aquí.
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      ...toJobRow(parsed.data),
      organization_id: profile.organization_id,
      requested_by: profile.id,
      owner_id: ADMIN_ROLES.has(profile.role) ? profile.id : null,
      status: "borrador",
      slug: generateJobSlug(parsed.data.title),
    })
    .select("id")
    .single();

  if (error || !job) {
    return { error: "No se pudo crear la vacante. Inténtalo de nuevo." };
  }

  const { error: stagesError } = await materializeJobStages(job.id, profile.organization_id);
  if (stagesError) {
    // La vacante ya existe pero sin pipeline — se deja visible para que un
    // admin la revise en vez de deshacer el insert silenciosamente.
    return { error: stagesError };
  }

  revalidatePath("/vacantes");
  redirect(`/vacantes/${job.id}?creada=1`);
}

export async function updateJob(
  jobId: string,
  _prevState: JobActionResult | undefined,
  formData: FormData,
): Promise<JobActionResult> {
  const profile = await requireProfile();
  const parsed = JobFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos del formulario." };
  }

  const supabase = await createClient();

  const departmentError = await assertValidDepartment(supabase, profile.organization_id, parsed.data.department_id);
  if (departmentError) return { error: departmentError };

  // RLS decide si esta fila es editable para este actor (admin+, o el propio
  // solicitante mientras siga en "borrador") — un 0 filas afectadas aquí es
  // la señal de que no tenía permiso o el estado ya cambió, no una excepción.
  const { data, error } = await supabase
    .from("jobs")
    .update(toJobRow(parsed.data))
    .eq("id", jobId)
    .eq("organization_id", profile.organization_id)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "No se pudo guardar. Puede que la vacante ya no esté en borrador." };
  }

  revalidatePath("/vacantes");
  revalidatePath(`/vacantes/${jobId}`);
  return { success: "Vacante actualizada" };
}

const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  borrador: ["pendiente_aprobacion", "abierta", "cancelada"],
  pendiente_aprobacion: ["abierta", "borrador", "cancelada"],
  abierta: ["pausada", "cerrada"],
  pausada: ["abierta", "cerrada"],
  cerrada: [],
  cancelada: [],
};

const SUCCESS_MESSAGE: Record<JobStatus, string> = {
  borrador: "Vacante regresada a borrador",
  pendiente_aprobacion: "Vacante enviada a aprobación",
  abierta: "Vacante publicada",
  pausada: "Vacante pausada",
  cerrada: "Vacante cerrada",
  cancelada: "Vacante cancelada",
};

type CurrentJob = { status: JobStatus; requested_by: string | null; published_at: string | null };
type TransitionGuard = (actorRole: AppRole, actorId: string, current: CurrentJob) => string | null;

async function transitionJob(jobId: string, to: JobStatus, guard: TransitionGuard): Promise<JobActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("jobs")
    .select("status, requested_by, published_at")
    .eq("id", jobId)
    .eq("organization_id", profile.organization_id)
    .single();

  if (!current) return { error: "No se encontró la vacante." };
  if (!VALID_TRANSITIONS[current.status].includes(to)) {
    return { error: "Esa vacante no puede pasar a ese estado desde donde está." };
  }

  const guardError = guard(profile.role, profile.id, current);
  if (guardError) return { error: guardError };

  // Solo se marca la primera vez que se publica — reabrir tras pausarla no
  // debe reiniciar la fecha, o el portal público la mostraría como recién
  // creada aunque lleve semanas abierta.
  const extra = to === "abierta" && !current.published_at ? { published_at: new Date().toISOString() } : {};

  // `.eq("status", current.status)` es un compare-and-swap: si dos personas
  // disparan una transición sobre la misma vacante casi al mismo tiempo (dos
  // pestañas, o clic en dos botones antes de que el primero deshabilite los
  // demás), solo la que gana la carrera de verdad cambia la fila — la otra
  // actualiza 0 filas y recibe el error de abajo en vez de pisar en silencio
  // el resultado de la primera.
  const { data, error } = await supabase
    .from("jobs")
    .update({ status: to, ...extra })
    .eq("id", jobId)
    .eq("organization_id", profile.organization_id)
    .eq("status", current.status)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "La vacante cambió de estado justo ahora. Actualiza la página e inténtalo de nuevo." };
  }

  revalidatePath("/vacantes");
  revalidatePath(`/vacantes/${jobId}`);
  return { success: SUCCESS_MESSAGE[to] };
}

const adminOnly = (message: string): TransitionGuard => (actorRole) =>
  ADMIN_ROLES.has(actorRole) ? null : message;

const ownerOrAdmin = (message: string): TransitionGuard => (actorRole, actorId, current) =>
  ADMIN_ROLES.has(actorRole) || current.requested_by === actorId ? null : message;

// RLS (jobs_update) solo deja a quien no es admin editar su propia fila
// mientras sigue en "borrador" — cancelar desde "pendiente_aprobacion" ya
// no lo permite la base, aunque sea el mismo solicitante. Sin este chequeo
// extra, cancelJob() prometería un permiso que el UPDATE real rechazaría.
const cancelGuard: TransitionGuard = (actorRole, actorId, current) =>
  ADMIN_ROLES.has(actorRole) || (current.requested_by === actorId && current.status === "borrador")
    ? null
    : "No puedes cancelar esta vacante.";

/**
 * Se invoca siempre envuelta en notifyBestEffort() — corre con after(),
 * después de responder, así que un fallo aquí nunca hace fallar el envío a
 * aprobación en sí. Cliente admin porque hace falta ver a TODOS los admin+
 * de la organización, no solo los que el actor (a menudo un gestor) pueda
 * ver por RLS.
 */
async function notifyPendingApproval(jobId: string, organizationId: string, submitterId: string): Promise<void> {
  const admin = createAdminClient();
  const [{ data: job }, { data: approvers }] = await Promise.all([
    admin.from("jobs").select("title").eq("id", jobId).single(),
    admin.from("profiles").select("id").eq("organization_id", organizationId).in("role", ["admin", "super_admin"]),
  ]);
  if (!job || !approvers) return;
  // Si quien envió a aprobación es admin+ (permitido por ownerOrAdmin), no
  // tiene sentido avisarle que su propia acción "está esperando su revisión".
  const recipients = approvers.filter((approver) => approver.id !== submitterId);
  if (recipients.length === 0) return;

  const { platformName, siteUrl } = await getEmailContext();
  const jobUrl = `${siteUrl}/vacantes/${jobId}`;

  await Promise.all(
    recipients.map((approver) =>
      notify({
        organizationId,
        recipientId: approver.id,
        type: "vacante_pendiente_aprobacion",
        title: "Vacante pendiente de aprobación",
        body: `"${job.title}" está esperando tu revisión.`,
        url: `/vacantes/${jobId}`,
        entityType: "job",
        entityId: jobId,
        email: {
          subject: "Vacante pendiente de aprobación",
          react: VacantePendienteAprobacionEmail({ platformName, jobTitle: job.title, jobUrl }),
        },
      }),
    ),
  );
}

export async function submitForApproval(jobId: string): Promise<JobActionResult> {
  const profile = await requireProfile();
  const result = await transitionJob(
    jobId,
    "pendiente_aprobacion",
    ownerOrAdmin("Solo quien solicitó la vacante puede enviarla a aprobación."),
  );
  if (result.success) {
    notifyBestEffort(() => notifyPendingApproval(jobId, profile.organization_id, profile.id));
  }
  return result;
}

export async function approveAndPublish(jobId: string): Promise<JobActionResult> {
  return transitionJob(jobId, "abierta", adminOnly("Solo RH puede aprobar y publicar una vacante."));
}

export async function rejectApproval(jobId: string): Promise<JobActionResult> {
  return transitionJob(jobId, "borrador", adminOnly("Solo RH puede regresar una vacante a borrador."));
}

export async function pauseJob(jobId: string): Promise<JobActionResult> {
  return transitionJob(jobId, "pausada", adminOnly("Solo RH puede pausar una vacante."));
}

export async function reopenJob(jobId: string): Promise<JobActionResult> {
  return transitionJob(jobId, "abierta", adminOnly("Solo RH puede reabrir una vacante."));
}

export async function closeJob(jobId: string): Promise<JobActionResult> {
  return transitionJob(jobId, "cerrada", adminOnly("Solo RH puede cerrar una vacante."));
}

export async function cancelJob(jobId: string): Promise<JobActionResult> {
  return transitionJob(jobId, "cancelada", cancelGuard);
}

const ReferCandidateSchema = z.object({
  full_name: z.string().trim().min(3, { error: "Escribe el nombre completo." }).max(120),
  email: z.email({ error: "Correo inválido." }),
  phone: z.string().trim().min(6, { error: "Escribe un teléfono válido." }).max(30),
});

export async function referCandidate(
  jobId: string,
  _prevState: JobActionResult | undefined,
  formData: FormData,
): Promise<JobActionResult> {
  const profile = await requireProfile();
  const parsed = ReferCandidateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos del candidato." };
  }

  const supabase = await createClient();

  const { data: job } = await supabase
    .from("jobs")
    .select("title, status, owner_id, requested_by")
    .eq("id", jobId)
    .single();
  if (!job) return { error: "No se encontró la vacante." };
  if (TERMINAL_JOB_STATUSES.has(job.status)) {
    return { error: "Esta vacante ya no acepta candidatos." };
  }

  const candidateResult = await findOrCreateCandidate(profile.organization_id, {
    full_name: parsed.data.full_name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    source: "referido",
    referred_by: profile.id,
    created_by: profile.id,
  });
  if ("error" in candidateResult) return { error: candidateResult.error };

  const applicationResult = await createApplicationForCandidate(
    supabase,
    profile.organization_id,
    jobId,
    candidateResult.candidateId,
    candidateResult.isNewCandidate,
  );

  if ("error" in applicationResult) {
    // RLS puede negar el insert de la postulación si este colaborador no
    // tiene acceso a la vacante — el mensaje genérico cubre ese caso además
    // del error real reportado por createApplicationForCandidate.
    return { error: applicationResult.error };
  }

  await supabase.from("application_events").insert({
    organization_id: profile.organization_id,
    application_id: applicationResult.applicationId,
    type: "postulacion_creada",
    actor_id: profile.id,
    payload: { origen: "referido_interno" },
  });

  // Best-effort, corre con after(): avisar al dueño de la vacante (o, si
  // aún no tiene, a quien la solicitó) que llegó un referido — salvo que
  // sea la misma persona que acaba de referirlo, evitando notificarse a
  // sí mismo.
  const jobRecipientId = job.owner_id ?? job.requested_by;
  if (jobRecipientId && jobRecipientId !== profile.id) {
    notifyBestEffort(async () => {
      const { platformName, siteUrl } = await getEmailContext();
      const applicationUrl = `${siteUrl}/postulaciones/${applicationResult.applicationId}`;
      await notify({
        organizationId: profile.organization_id,
        recipientId: jobRecipientId,
        type: "nueva_postulacion",
        title: "Nueva postulación",
        body: `${parsed.data.full_name} fue referido para "${job.title}".`,
        url: `/postulaciones/${applicationResult.applicationId}`,
        entityType: "application",
        entityId: applicationResult.applicationId,
        email: {
          subject: "Nueva postulación",
          react: NuevaPostulacionEmail({
            platformName,
            candidateName: parsed.data.full_name,
            jobTitle: job.title,
            applicationUrl,
          }),
        },
      });
    });
  }

  revalidatePath(`/vacantes/${jobId}`);
  return { success: "Candidato referido" };
}
