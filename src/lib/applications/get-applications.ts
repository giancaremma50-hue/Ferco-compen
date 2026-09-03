import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type KanbanStage = { id: string; name: string; position: number };
export type KanbanCard = {
  id: string;
  candidateId: string;
  candidateName: string;
  rating: number | null;
  stageId: string;
  appliedAt: string;
};
export type KanbanData = { stages: KanbanStage[]; cards: KanbanCard[] };

/** RLS de applications_select/job_stages_select ya decide qué ve este viewer. */
export async function getKanbanData(jobId: string): Promise<KanbanData> {
  const supabase = await createClient();

  const [{ data: stages }, { data: applications }] = await Promise.all([
    supabase.from("job_stages").select("id, name, position").eq("job_id", jobId).order("position"),
    supabase
      .from("applications")
      .select("id, stage_id, rating, applied_at, candidates(id, full_name)")
      .eq("job_id", jobId)
      .eq("status", "activa"),
  ]);

  const cards: KanbanCard[] = (applications ?? []).map((a) => ({
    id: a.id,
    candidateId: a.candidates!.id,
    candidateName: a.candidates!.full_name,
    rating: a.rating,
    stageId: a.stage_id,
    appliedAt: a.applied_at,
  }));

  return { stages: stages ?? [], cards };
}

export type ApplicationEvent = {
  id: string;
  type: Database["public"]["Enums"]["application_event_type"];
  actorName: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};
export type ApplicationNote = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  isPrivate: boolean;
  createdAt: string;
};
export type ApplicationTask = {
  id: string;
  description: string;
  isDone: boolean;
  createdByName: string;
  assignedToId: string | null;
  assignedToName: string | null;
  dueDate: string | null;
  createdAt: string;
};
export type ApplicationDetail = {
  id: string;
  status: Database["public"]["Enums"]["application_status"];
  rating: number | null;
  stageId: string;
  stageName: string | null;
  jobId: string;
  jobTitle: string | null;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  candidateAddress: string | null;
  cvFilePath: string | null;
  coverLetter: string | null;
  rejectionReasonLabel: string | null;
  events: ApplicationEvent[];
  notes: ApplicationNote[];
  tasks: ApplicationTask[];
};

/**
 * jobTitle/stageName pueden venir null aunque la fila de `applications`
 * exista: `applications_select` deja ver esta postulación a un colaborador
 * que refirió al candidato (`candidate_referred_by_me`) sin exigir nada
 * sobre el estado de la vacante, pero `jobs_select`/`job_stages_select`
 * exigen que la vacante siga pública+abierta o que el actor tenga acceso
 * interno — si la vacante se pausó o cerró después, esos joins vuelven
 * `null` para ese mismo colaborador aunque la postulación siga visible.
 */
export async function getApplicationDetail(applicationId: string): Promise<ApplicationDetail | null> {
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("applications")
    .select(
      "id, status, rating, stage_id, job_stages(name), job_id, jobs(title), candidate_id, candidates(full_name, email, phone, address, cv_file_path), rejection_reason_id, rejection_reasons(label), cover_letter",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return null;

  const [{ data: events }, { data: notes }, { data: tasks }] = await Promise.all([
    supabase
      .from("application_events")
      .select("id, type, payload, created_at, actor_id, profiles(display_name)")
      .eq("application_id", applicationId)
      .order("created_at"),
    supabase
      .from("notes")
      .select("id, author_id, body, is_private, created_at, profiles(display_name)")
      .eq("application_id", applicationId)
      .order("created_at"),
    supabase
      .from("candidate_tasks")
      .select(
        "id, description, is_done, created_at, due_date, assigned_to, creator:profiles!candidate_tasks_created_by_fkey(display_name), assignee:profiles!candidate_tasks_assigned_to_fkey(display_name)",
      )
      .eq("application_id", applicationId)
      .order("created_at"),
  ]);

  return {
    id: app.id,
    status: app.status,
    rating: app.rating,
    stageId: app.stage_id,
    stageName: app.job_stages?.name ?? null,
    jobId: app.job_id,
    jobTitle: app.jobs?.title ?? null,
    candidateId: app.candidate_id,
    candidateName: app.candidates!.full_name,
    candidateEmail: app.candidates!.email,
    candidatePhone: app.candidates!.phone,
    candidateAddress: app.candidates!.address,
    cvFilePath: app.candidates!.cv_file_path,
    coverLetter: app.cover_letter,
    rejectionReasonLabel: app.rejection_reasons?.label ?? null,
    events: (events ?? []).map((e) => ({
      id: e.id,
      type: e.type,
      actorName: e.profiles?.display_name ?? null,
      payload: (e.payload as Record<string, unknown>) ?? {},
      createdAt: e.created_at,
    })),
    notes: (notes ?? []).map((n) => ({
      id: n.id,
      authorId: n.author_id,
      authorName: n.profiles?.display_name ?? "Alguien",
      body: n.body,
      isPrivate: n.is_private,
      createdAt: n.created_at,
    })),
    tasks: (tasks ?? []).map((t) => ({
      id: t.id,
      description: t.description,
      isDone: t.is_done,
      createdByName: t.creator?.display_name ?? "Alguien",
      assignedToId: t.assigned_to,
      assignedToName: t.assignee?.display_name ?? null,
      dueDate: t.due_date,
      createdAt: t.created_at,
    })),
  };
}

export type AssignableProfile = { id: string; display_name: string };

/**
 * Gente de ESTA vacante, y solo de esta vacante: reclutador asignado,
 * solicitante y miembros agregados, todos activos. Alimenta tanto el
 * selector de "asignar tarea" como los destinatarios de una reunión.
 *
 * Antes traía además a TODOS los admin de la organización, sin importar si
 * tenían algo que ver con la vacante — ruido en el selector, y podía
 * invitarse a una entrevista a alguien totalmente ajeno al proceso
 * (decisión del usuario, 2026-09-03: solo gente de la vacante). El costo
 * aceptado: para asignarle algo a otro admin hay que sumarlo como miembro
 * primero, lo que vuelve la membresía significativa en vez de decorativa.
 *
 * `!inner` en el join fuerza el filtro is_active como WHERE real — con un
 * join normal (left) solo dejaría el embed en null, sin excluir la fila.
 */
export async function getAssignableProfiles(jobId: string, organizationId: string): Promise<AssignableProfile[]> {
  const supabase = await createClient();
  const [{ data: job }, { data: members }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "owner:profiles!jobs_owner_id_fkey(id, display_name, is_active), requester:profiles!jobs_requested_by_fkey(id, display_name, is_active)",
      )
      .eq("id", jobId)
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("job_collaborators")
      .select("profile_id, permission, profile:profiles!job_collaborators_profile_id_fkey!inner(display_name)")
      .eq("job_id", jobId)
      .eq("profile.is_active", true),
  ]);

  const byId = new Map<string, string>();
  for (const person of [job?.owner, job?.requester]) {
    if (person?.is_active) byId.set(person.id, person.display_name);
  }
  // Un miembro de SOLO LECTURA no puede escribir: asignarle una tarea le
  // dejaría un pendiente que no puede completar, e invitarlo como
  // destinatario de una entrevista le dejaría botones que el servidor
  // rechaza. Fuera de la lista.
  (members ?? []).forEach((c) => {
    if (c.profile && c.permission !== "solo_lectura" && c.permission !== "viewer") {
      byId.set(c.profile_id, c.profile.display_name);
    }
  });

  return Array.from(byId, ([id, display_name]) => ({ id, display_name })).sort((a, b) =>
    a.display_name.localeCompare(b.display_name),
  );
}

/** true si `profileId` está en la lista de gente asignable de esta vacante — usado por addTask para no confiar en el <select> del cliente. */
export async function isProfileAssignable(profileId: string, jobId: string, organizationId: string): Promise<boolean> {
  const assignable = await getAssignableProfiles(jobId, organizationId);
  return assignable.some((p) => p.id === profileId);
}
