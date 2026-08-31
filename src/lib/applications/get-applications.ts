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
  cvFilePath: string | null;
  rejectionReasonLabel: string | null;
  events: ApplicationEvent[];
  notes: ApplicationNote[];
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
      "id, status, rating, stage_id, job_stages(name), job_id, jobs(title), candidate_id, candidates(full_name, email, phone, cv_file_path), rejection_reason_id, rejection_reasons(label)",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return null;

  const [{ data: events }, { data: notes }] = await Promise.all([
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
    cvFilePath: app.candidates!.cv_file_path,
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
  };
}
