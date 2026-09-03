"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireProfile } from "@/lib/auth/dal";
import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { JobFormSchema, CreateJobFromTemplateSchema, JobVisibilitySchema } from "./schema";
import type { JobStatus, JobVisibility, JobFormValues } from "./schema";
import { generateJobSlug } from "./slug";
import { assertBelongsToOrg } from "@/lib/assert-belongs-to-org";
import { TERMINAL_JOB_STATUSES } from "./permissions";
import { findOrCreateCandidate, createApplicationForCandidate } from "./create-application";
import { notify, notifyBestEffort, getEmailContext } from "@/lib/notifications/notify";
import { zodFieldError } from "@/lib/forms/zod-error";
import { VacantePendienteAprobacionEmail } from "@/emails/vacante-pendiente-aprobacion";
import { VacanteCambioEstadoEmail } from "@/emails/vacante-cambio-estado";
import { NuevaPostulacionEmail } from "@/emails/nueva-postulacion";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

export type JobActionResult = { error?: string; success?: string; field?: string };

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

/**
 * "Reclutador asignado" — se elige al ACEPTAR la solicitud (acceptJobRequest),
 * ya no al crearla. Revalida rol+organización+activo, no solo que la fila
 * exista — un <select> filtrado en el cliente no es una garantía server-side.
 */
async function assertValidOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  ownerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", ownerId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("role", ["admin", "super_admin"])
    .maybeSingle();
  return data ? null : "Esa persona no puede quedar como reclutador asignado.";
}

/** Colaboradores adicionales — mismo criterio que job_collaborators ya exige hoy (cualquier miembro activo de la org). */
async function assertValidCollaborators(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  profileIds: string[],
): Promise<string | null> {
  if (profileIds.length === 0) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("id", profileIds);
  const validIds = new Set((data ?? []).map((p) => p.id));
  return profileIds.every((id) => validIds.has(id)) ? null : "Alguno de los colaboradores elegidos no es válido.";
}

/** `requester_id`: en nombre de quién solicita un admin — cualquier miembro activo de la org, no solo gestores (un admin también podría solicitar en nombre de otro admin). */
async function assertValidRequester(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  requesterId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", requesterId)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .maybeSingle();
  return data ? null : "Esa persona no es válida como solicitante.";
}

/** `extra_admin_ids`: admins adicionales que un admin agrega al equipo al crear la vacante él mismo. */
async function assertValidExtraAdmins(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  profileIds: string[],
): Promise<string | null> {
  if (profileIds.length === 0) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("role", ["admin", "super_admin"])
    .in("id", profileIds);
  const validIds = new Set((data ?? []).map((p) => p.id));
  return profileIds.every((id) => validIds.has(id)) ? null : "Alguno de los admins elegidos no es válido.";
}

/**
 * Crea una vacante a partir de una plantilla — obligatoria desde esta fase
 * (Fase 18), ya no existe "vacante en blanco". El cliente solo manda
 * `template_id` y los campos que de verdad quedan editables (país,
 * ubicación, modalidad, tipo de contrato, salario, plazas, tipo/motivo de
 * vacante, equipo) — título, descripción, requisitos, candidatura,
 * preguntas y etapas se vuelven a leer server-side desde la plantilla,
 * nunca del contenido que mande el formulario (mismo principio de
 * seguridad que Fase 17 con pipeline_template_id: el cliente
 * nunca manda el contenido que un rol sin acceso directo a esas tablas no
 * podría escribir él mismo).
 *
 * Dos caminos, decididos por el ROL REAL del actor (nunca por lo que mande
 * el formulario): un gestor solicita y queda en "borrador" — el flujo de
 * siempre (submitForApproval → RH acepta/publica). Un admin+ que crea una
 * vacante YA es la aprobación: nace directo en "aceptada", él se autoasigna
 * como encargado, y puede elegir en nombre de qué gestor se solicita
 * (`requester_id`) y sumar más admins al equipo (`extra_admin_ids`).
 */
export async function createJob(
  _prevState: JobActionResult | undefined,
  formData: FormData,
): Promise<JobActionResult> {
  const profile = await requireProfile();
  // Sin guardia de rol: los 3 roles que existen pueden solicitar una vacante.
  // Acá vivía un bloqueo para `colaborador`, retirado junto con el rol —
  // ningún camino de la aplicación lo asigna ya (ASSIGNABLE_ROLES es lista
  // blanca, y el default de `profiles.role`/`handle_new_user()` es `gestor`).
  const parsed = CreateJobFromTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return zodFieldError(parsed.error, "Revisa los datos del formulario.");
  }

  const supabase = await createClient();
  const isAdminCreator = ADMIN_ROLES.has(profile.role);

  const [reasonError, collaboratorsError, requesterError, extraAdminsError] = await Promise.all([
    assertBelongsToOrg(supabase, "employment_reasons", parsed.data.employment_reason_id, profile.organization_id, "Ese motivo de vacante no es válido."),
    assertValidCollaborators(supabase, profile.organization_id, parsed.data.collaborator_ids),
    isAdminCreator && parsed.data.requester_id
      ? assertValidRequester(supabase, profile.organization_id, parsed.data.requester_id)
      : Promise.resolve(null),
    isAdminCreator ? assertValidExtraAdmins(supabase, profile.organization_id, parsed.data.extra_admin_ids) : Promise.resolve(null),
  ]);
  if (reasonError) return { error: reasonError };
  if (collaboratorsError) return { error: collaboratorsError };
  if (requesterError) return { error: requesterError };
  if (extraAdminsError) return { error: extraAdminsError };

  const { data: template } = await supabase
    .from("job_templates")
    .select("id, title, department_id, description, requirements, candidacy_fields")
    .eq("id", parsed.data.template_id)
    .eq("organization_id", profile.organization_id)
    .eq("status", "published")
    .maybeSingle();
  if (!template) return { error: "Esa plantilla ya no está disponible." };

  const requestedBy = isAdminCreator && parsed.data.requester_id ? parsed.data.requester_id : profile.id;
  const ownerId = isAdminCreator ? profile.id : null;

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      organization_id: profile.organization_id,
      title: template.title,
      department_id: template.department_id,
      country: parsed.data.country,
      location: parsed.data.location,
      work_mode: parsed.data.work_mode,
      employment_type: parsed.data.employment_type,
      description: template.description,
      requirements: template.requirements,
      salary_min: parsed.data.salary_min ?? null,
      salary_max: parsed.data.salary_max ?? null,
      headcount: parsed.data.headcount,
      vacancy_type: parsed.data.vacancy_type,
      employment_reason_id: parsed.data.employment_reason_id ?? null,
      job_template_id: template.id,
      candidacy_fields: template.candidacy_fields,
      requested_by: requestedBy,
      owner_id: ownerId,
      // Explícito, no el default de la columna — publishJob() exige elegir
      // visibilidad a propósito ("no hay valor por defecto silencioso para
      // algo que decide quién ve la vacante"), sería inconsistente confiar
      // en un default implícito acá mismo, un insert antes.
      visibility: "confidencial",
      // Gestor: borrador -> pendiente_aprobacion (submitForApproval, como
      // siempre). Admin+: su creación ya ES la aprobación, nace lista para
      // publicar. La visibilidad recién elegida arriba no cambia hasta
      // publishJob — nadie fuera del equipo la ve todavía, aunque status ya
      // sea "aceptada".
      status: isAdminCreator ? "aceptada" : "borrador",
      slug: generateJobSlug(template.title),
    })
    .select("id")
    .single();

  if (error || !job) {
    return { error: "No se pudo crear la vacante. Inténtalo de nuevo." };
  }

  // Todo lo que sigue exige admin+ para escribir (job_stages, job_questions,
  // job_question_options, job_collaborators) — un gestor
  // SÍ puede crear su propia vacante, pero no tiene RLS de escritura directa
  // sobre esas tablas. Mismo motivo que materializeJobStages
  // en Fase 4/17: cliente admin acá, con el contenido ya releído del
  // servidor arriba (nunca del FormData) y el job.id que ACABAMOS de crear
  // (nunca uno que mande el cliente).
  const admin = createAdminClient();

  const [{ data: templateStages }, { data: templateQuestions }] = await Promise.all([
    admin.from("job_template_stages").select("title, type, position").eq("job_template_id", template.id).order("position"),
    admin
      .from("job_template_questions")
      .select("prompt, type, position, job_template_question_options(label, is_expected, position)")
      .eq("job_template_id", template.id)
      .order("position")
      .order("position", { referencedTable: "job_template_question_options" }),
  ]);

  if (!templateStages || templateStages.length === 0) {
    // No debería pasar — publishTemplate exige al menos una etapa antes de
    // publicar — pero si pasa, mejor una vacante visible sin pipeline (que
    // un admin puede investigar) que fingir que se creó bien.
    return { error: "Esta plantilla no tiene etapas configuradas. Avisa a quien la administra antes de usarla." };
  }

  const { error: stagesError } = await admin.from("job_stages").insert(
    templateStages.map((s) => ({
      organization_id: profile.organization_id,
      job_id: job.id,
      name: s.title,
      type: s.type,
      position: s.position,
    })),
  );
  if (stagesError) {
    console.error("createJob: no se pudieron copiar las etapas de la plantilla", stagesError);
    return { error: "No se pudo preparar el pipeline de esta vacante." };
  }

  if (templateQuestions && templateQuestions.length > 0) {
    const questionRows = templateQuestions.map((q) => ({
      id: crypto.randomUUID(),
      organization_id: profile.organization_id,
      job_id: job.id,
      prompt: q.prompt,
      type: q.type,
      position: q.position,
    }));
    const { error: questionsError } = await admin.from("job_questions").insert(questionRows);
    if (questionsError) {
      console.error("createJob: no se pudieron copiar las preguntas de la plantilla", questionsError);
    } else {
      const optionRows = templateQuestions.flatMap((q, i) =>
        (q.job_template_question_options ?? []).map((o) => ({
          organization_id: profile.organization_id,
          job_id: job.id,
          question_id: questionRows[i].id,
          label: o.label,
          is_expected: o.is_expected,
          position: o.position,
        })),
      );
      if (optionRows.length > 0) {
        const { error: optionsError } = await admin.from("job_question_options").insert(optionRows);
        if (optionsError) console.error("createJob: no se pudieron copiar las opciones de las preguntas", optionsError);
      }
    }
  }

  // Un mismo profile_id no puede aparecer dos veces (UNIQUE(job_id,
  // profile_id)) — se arma con un Map en vez de un array plano, insertando
  // del nivel más bajo al más alto, así el nivel más alto que le toque a
  // cada persona es el que queda (ej. si el encargado además aparece como
  // "colaborador adicional" por error del formulario, gana "owner", no
  // "viewer"). Quien solicitó siempre queda approver de su propia
  // vacante — sin esto, un gestor que pidió una vacante no podría decidir
  // sobre sus propias postulaciones una vez que los niveles de
  // job_collaborators aplican a todos menos admin+.
  const permissionByProfile = new Map<string, "solo_lectura" | "lectura_escritura">();
  for (const id of parsed.data.collaborator_ids) permissionByProfile.set(id, "solo_lectura");
  permissionByProfile.set(requestedBy, "lectura_escritura");
  if (isAdminCreator) {
    for (const id of parsed.data.extra_admin_ids) permissionByProfile.set(id, "lectura_escritura");
  }
  if (ownerId) permissionByProfile.set(ownerId, "lectura_escritura");

  const collaboratorRows = Array.from(permissionByProfile, ([profile_id, permission]) => ({
    organization_id: profile.organization_id,
    job_id: job.id,
    profile_id,
    permission,
  }));
  const { error: collaboratorsInsertError } = await admin.from("job_collaborators").insert(collaboratorRows);
  if (collaboratorsInsertError) {
    console.error("createJob: no se pudo armar el equipo de reclutamiento", collaboratorsInsertError);
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
    return zodFieldError(parsed.error, "Revisa los datos del formulario.");
  }

  const supabase = await createClient();

  const departmentError = await assertBelongsToOrg(supabase, "departments", parsed.data.department_id, profile.organization_id, "Ese departamento no es válido.");
  if (departmentError) return { error: departmentError, field: "department_id" };

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

// pendiente_aprobacion ya no salta directo a "abierta" — aprobar y publicar
// son dos pasos separados (aceptada, en medio) desde que RH necesita elegir
// encargado y visibilidad por separado, no de una sola vez. "borrador"
// tampoco salta directo a "abierta" (se quitó el atajo de admin) — todo
// camino a "abierta" pasa por "aceptada", una sola forma de publicar en vez
// de dos con distinto comportamiento.
const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  borrador: ["pendiente_aprobacion", "cancelada"],
  pendiente_aprobacion: ["aceptada", "borrador", "cancelada"],
  aceptada: ["abierta", "cancelada"],
  abierta: ["pausada", "cerrada"],
  pausada: ["abierta", "cerrada"],
  cerrada: [],
  cancelada: [],
};

const SUCCESS_MESSAGE: Record<JobStatus, string> = {
  borrador: "Vacante regresada a borrador",
  pendiente_aprobacion: "Vacante enviada a aprobación",
  aceptada: "Solicitud aceptada",
  abierta: "Vacante publicada",
  pausada: "Vacante pausada",
  cerrada: "Vacante cerrada",
  cancelada: "Vacante cancelada",
};

type CurrentJob = { status: JobStatus; requested_by: string | null; published_at: string | null };
type TransitionGuard = (actorRole: AppRole, actorId: string, current: CurrentJob) => string | null;

async function transitionJob(
  jobId: string,
  to: JobStatus,
  guard: TransitionGuard,
  extraFields: Record<string, unknown> = {},
): Promise<JobActionResult> {
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
    .update({ status: to, ...extra, ...extraFields })
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

/** Frase por estado — el correo y la notificación in-app comparten el texto. */
type StatusCopyKey = JobStatus | "reabierta";

const STATUS_MESSAGE: Partial<Record<StatusCopyKey, { heading: string; message: string }>> = {
  aceptada: { heading: "Solicitud aceptada", message: "fue aceptada por RH y ya tiene reclutador asignado." },
  borrador: { heading: "Solicitud devuelta", message: "fue devuelta para que la ajustes y la vuelvas a enviar." },
  abierta: { heading: "Vacante publicada", message: "ya está publicada y recibiendo candidatos." },
  // reopenJob comparte el estado "abierta" pero no la frase: avisar "ya está
  // publicada" de una vacante publicada hace semanas sería falso.
  reabierta: { heading: "Vacante reabierta", message: "volvió a estar abierta y recibiendo candidatos." },
  pausada: { heading: "Vacante pausada", message: "quedó pausada: no recibe candidatos nuevos por ahora." },
  cerrada: { heading: "Vacante cerrada", message: "se cerró." },
  cancelada: { heading: "Vacante cancelada", message: "se canceló." },
};

/**
 * Avisa a los involucrados de un cambio de estado de la vacante. Corre
 * siempre envuelta en notifyBestEffort() — un fallo del correo nunca deshace
 * la transición que ya se guardó.
 *
 * Antes solo existía el aviso de "pendiente de aprobación" hacia RH: aceptar,
 * devolver, publicar, pausar, cerrar y cancelar no avisaban a nadie, así que
 * quien solicitó una vacante quedaba a ciegas todo el resto del recorrido
 * (decisión del usuario, 2026-09-03: notificar en cada estado).
 *
 * Cliente admin porque hay que leer a TODOS los involucrados (solicitante,
 * reclutador asignado, miembros), no solo los que el actor alcance por RLS.
 * Nunca se notifica a quien ejecutó la acción.
 */
async function notifyJobStatusChange(
  jobId: string,
  organizationId: string,
  actorId: string,
  to: StatusCopyKey,
  reason?: string | null,
): Promise<void> {
  const copy = STATUS_MESSAGE[to];
  if (!copy) return;

  const admin = createAdminClient();
  const [{ data: job }, { data: members }] = await Promise.all([
    admin.from("jobs").select("title, requested_by, owner_id").eq("id", jobId).eq("organization_id", organizationId).single(),
    // Solo hacen falta para los estados que avisan a todo el equipo.
    admin.from("job_collaborators").select("profile_id").eq("job_id", jobId),
  ]);
  if (!job) return;

  // Devolver le concierne solo a quien tiene que corregirla; aceptar, solo a
  // quien la pidió y a quien la va a llevar; el resto de los cambios sí
  // interesa a todo el equipo de la vacante.
  const recipientIds =
    to === "borrador"
      ? [job.requested_by]
      : to === "aceptada"
        ? [job.requested_by, job.owner_id]
        : [job.requested_by, job.owner_id, ...(members ?? []).map((m) => m.profile_id)];

  const unique = [...new Set(recipientIds.filter((id): id is string => Boolean(id) && id !== actorId))];
  if (unique.length === 0) return;

  const { platformName, siteUrl } = await getEmailContext();
  const jobUrl = `${siteUrl}/vacantes/${jobId}`;

  await Promise.all(
    unique.map((recipientId) =>
      notify({
        organizationId,
        recipientId,
        type: "vacante_cambio_estado",
        title: copy.heading,
        body: reason ? `"${job.title}" ${copy.message} Motivo: ${reason}` : `"${job.title}" ${copy.message}`,
        url: `/vacantes/${jobId}`,
        entityType: "job",
        entityId: jobId,
        email: {
          subject: copy.heading,
          react: VacanteCambioEstadoEmail({
            platformName,
            heading: copy.heading,
            jobTitle: job.title,
            message: copy.message,
            reason,
            jobUrl,
          }),
        },
      }),
    ),
  );
}

export async function submitForApproval(jobId: string): Promise<JobActionResult> {
  const profile = await requireProfile();
  // Se limpia el motivo de la devolución anterior: si no, quedaría pegado a
  // una solicitud ya corregida y el solicitante seguiría viendo por qué se
  // la devolvieron la vez pasada.
  const result = await transitionJob(
    jobId,
    "pendiente_aprobacion",
    ownerOrAdmin("Solo quien solicitó la vacante puede enviarla a aprobación."),
    { return_reason: null },
  );
  if (result.success) {
    notifyBestEffort(() => notifyPendingApproval(jobId, profile.organization_id, profile.id));
  }
  return result;
}

/**
 * Aceptar ya no publica de una — RH revisa la solicitud y asigna encargado;
 * publicarla (con su visibilidad) es un paso aparte, publishJob. El
 * encargado y quien solicitó quedan con acceso operativo real sobre la
 * vacante (job_collaborators), no solo con RLS de solo-ver: sin esto,
 * ninguno de los dos podría mover etapas ni decidir sobre sus propias
 * postulaciones (canDecideApplication exige nivel real para todos menos
 * admin+, ya no hay excepción por rol "colaborador").
 */
export async function acceptJobRequest(jobId: string, ownerId: string): Promise<JobActionResult> {
  const profile = await requireProfile();
  if (!ADMIN_ROLES.has(profile.role)) return { error: "Solo RH puede aceptar una solicitud de vacante." };

  const supabase = await createClient();
  const ownerError = await assertValidOwner(supabase, profile.organization_id, ownerId);
  if (ownerError) return { error: ownerError };

  const { data: job } = await supabase.from("jobs").select("requested_by").eq("id", jobId).single();

  const result = await transitionJob(jobId, "aceptada", adminOnly("Solo RH puede aceptar una solicitud de vacante."), {
    owner_id: ownerId,
  });
  if (result.error) return result;

  const admin = createAdminClient();
  const rows: { organization_id: string; job_id: string; profile_id: string; permission: "lectura_escritura" }[] = [
    { organization_id: profile.organization_id, job_id: jobId, profile_id: ownerId, permission: "lectura_escritura" },
  ];
  if (job?.requested_by && job.requested_by !== ownerId) {
    rows.push({ organization_id: profile.organization_id, job_id: jobId, profile_id: job.requested_by, permission: "lectura_escritura" });
  }
  const { error: collabError } = await admin.from("job_collaborators").upsert(rows, { onConflict: "job_id,profile_id" });
  if (collabError) console.error("acceptJobRequest: no se pudo asignar el equipo de la vacante", collabError);

  notifyBestEffort(() => notifyJobStatusChange(jobId, profile.organization_id, profile.id, "aceptada"));
  return result;
}

/**
 * Devolver exige motivo escrito: sin él, el solicitante ve su vacante de
 * vuelta en borrador y no tiene forma de saber qué corregir (decisión del
 * usuario, 2026-09-03). Se guarda en `jobs.return_reason` y viaja también en
 * la notificación; `submitForApproval` lo limpia al reenviar.
 */
export async function returnJobRequest(jobId: string, reason: string): Promise<JobActionResult> {
  const profile = await requireProfile();
  const parsed = z
    .string()
    .trim()
    .min(10, { error: "Explica en al menos 10 caracteres qué hay que corregir." })
    .max(1000, { error: "Máximo 1000 caracteres." })
    .safeParse(reason);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Escribe el motivo." };

  const result = await transitionJob(jobId, "borrador", adminOnly("Solo RH puede devolver una solicitud al solicitante."), {
    return_reason: parsed.data,
  });
  if (result.success) {
    notifyBestEffort(() => notifyJobStatusChange(jobId, profile.organization_id, profile.id, "borrador", parsed.data));
  }
  return result;
}

/** Publicar exige elegir visibilidad explícitamente — no hay valor "por defecto silencioso" para algo que decide quién ve la vacante. Revalidada con Zod, no solo confiada porque el tipo de TS diga JobVisibility — el cliente es el que arma este argumento. */
export async function publishJob(jobId: string, visibility: JobVisibility): Promise<JobActionResult> {
  const parsedVisibility = JobVisibilitySchema.safeParse(visibility);
  if (!parsedVisibility.success) return { error: "Elige una visibilidad válida." };
  const profile = await requireProfile();
  const result = await transitionJob(jobId, "abierta", adminOnly("Solo RH puede publicar una vacante."), {
    visibility: parsedVisibility.data,
  });
  if (result.success) {
    notifyBestEffort(() => notifyJobStatusChange(jobId, profile.organization_id, profile.id, "abierta"));
  }
  return result;
}

export async function pauseJob(jobId: string): Promise<JobActionResult> {
  const profile = await requireProfile();
  const result = await transitionJob(jobId, "pausada", adminOnly("Solo RH puede pausar una vacante."));
  if (result.success) {
    notifyBestEffort(() => notifyJobStatusChange(jobId, profile.organization_id, profile.id, "pausada"));
  }
  return result;
}

export async function reopenJob(jobId: string): Promise<JobActionResult> {
  const profile = await requireProfile();
  const result = await transitionJob(jobId, "abierta", adminOnly("Solo RH puede reabrir una vacante."));
  if (result.success) {
    notifyBestEffort(() => notifyJobStatusChange(jobId, profile.organization_id, profile.id, "reabierta"));
  }
  return result;
}

export async function closeJob(jobId: string): Promise<JobActionResult> {
  const profile = await requireProfile();
  const result = await transitionJob(jobId, "cerrada", adminOnly("Solo RH puede cerrar una vacante."));
  if (result.success) {
    notifyBestEffort(() => notifyJobStatusChange(jobId, profile.organization_id, profile.id, "cerrada"));
  }
  return result;
}

export async function cancelJob(jobId: string): Promise<JobActionResult> {
  const profile = await requireProfile();
  const result = await transitionJob(jobId, "cancelada", cancelGuard);
  if (result.success) {
    notifyBestEffort(() => notifyJobStatusChange(jobId, profile.organization_id, profile.id, "cancelada"));
  }
  return result;
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
    return zodFieldError(parsed.error, "Revisa los datos del candidato.");
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
