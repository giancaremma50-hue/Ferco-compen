import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type JobCompetency = Tables<"job_competencies">;

export async function getJobCompetencies(jobId: string): Promise<JobCompetency[]> {
  const supabase = await createClient();
  // Sin reordenamiento todavía — orden de creación (position siempre
  // queda en 0, ver comentario en addCompetency).
  const { data } = await supabase
    .from("job_competencies")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at");
  return data ?? [];
}

export type CompetencyScoreEntry = {
  evaluatorId: string;
  evaluatorName: string;
  score: number;
  comment: string | null;
};
export type CompetencyEvaluation = {
  competencyId: string;
  competencyName: string;
  weight: number;
  average: number | null;
  scores: CompetencyScoreEntry[];
  myScore: CompetencyScoreEntry | null;
};

/**
 * Une job_competencies (la rúbrica de la vacante) con lo que ya se
 * calificó de ESTA postulación — el promedio se calcula acá, no en SQL,
 * mismo criterio que el resto del proyecto (leer y computar en la capa
 * de app, ver getKanbanData/getApplicationDetail).
 */
export async function getApplicationEvaluations(
  applicationId: string,
  jobId: string,
  currentProfileId: string,
): Promise<CompetencyEvaluation[]> {
  const supabase = await createClient();
  const [competencies, { data: scores }] = await Promise.all([
    getJobCompetencies(jobId),
    supabase
      .from("application_competency_scores")
      .select("competency_id, evaluator_id, score, comment, evaluator:profiles!application_competency_scores_evaluator_id_fkey(display_name)")
      .eq("application_id", applicationId),
  ]);

  return competencies.map((competency) => {
    const rows = (scores ?? []).filter((s) => s.competency_id === competency.id);
    const entries: CompetencyScoreEntry[] = rows.map((s) => ({
      evaluatorId: s.evaluator_id,
      evaluatorName: s.evaluator?.display_name ?? "Alguien",
      score: s.score,
      comment: s.comment,
    }));
    const average = entries.length > 0 ? entries.reduce((sum, e) => sum + e.score, 0) / entries.length : null;

    return {
      competencyId: competency.id,
      competencyName: competency.name,
      weight: competency.weight,
      average,
      scores: entries,
      myScore: entries.find((e) => e.evaluatorId === currentProfileId) ?? null,
    };
  });
}
