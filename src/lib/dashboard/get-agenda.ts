import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getOrgDayRange } from "./org-clock";

export type AgendaInterview = {
  id: string;
  applicationId: string;
  scheduledAt: string;
  candidateName: string;
  jobTitle: string;
  location: string | null;
};

export type AgendaTask = {
  id: string;
  applicationId: string;
  description: string;
  candidateName: string;
  createdAt: string;
};

export type AgendaData = { interviews: AgendaInterview[]; tasks: AgendaTask[] };

/**
 * Agenda PERSONAL de quien mira Inicio, no de la organización — "qué tengo
 * que hacer hoy yo" es inherentemente por persona, así que admin y gestor
 * usan la misma consulta, solo cambia el `profileId`.
 *
 * `candidate_tasks` no tiene fecha de vencimiento (no existe esa columna
 * hoy) — se listan las pendientes más antiguas primero, no "vencidas": esa
 * palabra prometería una fecha límite que el esquema no guarda.
 */
export async function getTodayAgenda(profileId: string): Promise<AgendaData> {
  const supabase = await createClient();
  const { start: dayStart, end: dayEnd } = getOrgDayRange();

  const [{ data: interviewRows }, { data: taskRows }] = await Promise.all([
    supabase
      .from("interview_attendees")
      .select(
        "interviews!inner(id, application_id, scheduled_at, location, status, applications(candidates(full_name), jobs(title)))",
      )
      .eq("profile_id", profileId)
      .eq("interviews.status", "programada")
      .gte("interviews.scheduled_at", dayStart.toISOString())
      .lte("interviews.scheduled_at", dayEnd.toISOString()),
    supabase
      .from("candidate_tasks")
      .select("id, application_id, description, created_at, applications(candidates(full_name))")
      .eq("assigned_to", profileId)
      .eq("is_done", false)
      .order("created_at")
      .limit(10),
  ]);

  const interviews: AgendaInterview[] = (interviewRows ?? [])
    .map((r) => r.interviews)
    .filter((i): i is NonNullable<typeof i> => i !== null)
    .map((i) => ({
      id: i.id,
      applicationId: i.application_id,
      scheduledAt: i.scheduled_at,
      candidateName: i.applications?.candidates?.full_name ?? "Candidato",
      jobTitle: i.applications?.jobs?.title ?? "",
      location: i.location,
    }))
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());

  const tasks: AgendaTask[] = (taskRows ?? []).map((t) => ({
    id: t.id,
    applicationId: t.application_id,
    description: t.description,
    candidateName: t.applications?.candidates?.full_name ?? "Candidato",
    createdAt: t.created_at,
  }));

  return { interviews, tasks };
}
