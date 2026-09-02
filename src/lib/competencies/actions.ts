"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrAbove, requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { CompetencySchema, ScoreSchema } from "./schema";

export type CompetencyActionResult = { error?: string; success?: string };

export async function addCompetency(
  jobId: string,
  _prevState: CompetencyActionResult | undefined,
  formData: FormData,
): Promise<CompetencyActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = CompetencySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const supabase = await createClient();

  // El cliente nunca es fuente de verdad: jobId llega de la URL de la
  // página, sin garantía de que sea una vacante de ESTA organización —
  // mismo patrón ya aplicado a job_collaborators/head_profile_id.
  const { data: job } = await supabase
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (!job) return { error: "No se encontró la vacante." };

  const { error } = await supabase.from("job_competencies").insert({
    organization_id: profile.organization_id,
    job_id: jobId,
    name: parsed.data.name,
    weight: parsed.data.weight,
    // Sin lista para reordenar todavía — position solo preserva el orden
    // de creación. Cuando exista un reordenamiento real, ahí sí vale la
    // pena un valor mantenido (ver ponytail: no resolver un problema que
    // no existe aún — antes se calculaba con un COUNT extra y una
    // ventana de carrera real, ver napkin.md).
    position: 0,
  });
  if (error) return { error: "No se pudo agregar la competencia." };

  revalidatePath(`/vacantes/${jobId}`);
  return { success: "Competencia agregada" };
}

export async function deleteCompetency(competencyId: string, jobId: string): Promise<void> {
  await requireAdminOrAbove();
  const supabase = await createClient();
  const { error } = await supabase.from("job_competencies").delete().eq("id", competencyId).eq("job_id", jobId);
  if (error) throw new Error("No se pudo eliminar la competencia.");
  revalidatePath(`/vacantes/${jobId}`);
}

/**
 * Upsert de la calificación del evaluador actual — nunca la de otro
 * (evaluator_id sale del perfil autenticado, nunca de un parámetro).
 * unique(application_id, competency_id, evaluator_id) es el onConflict.
 */
export async function submitScore(
  applicationId: string,
  competencyId: string,
  _prevState: CompetencyActionResult | undefined,
  formData: FormData,
): Promise<CompetencyActionResult> {
  const profile = await requireProfile();
  const parsed = ScoreSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa la calificación." };

  const supabase = await createClient();

  // competencyId y applicationId llegan de la UI (donde siempre coinciden,
  // getApplicationEvaluations solo itera competencias de ESA vacante),
  // pero la Server Action es un endpoint de red — nada impide un POST con
  // un competencyId de OTRA vacante. Confirmar que ambos apuntan al mismo
  // job_id antes de guardar, mismo principio que la validación de etapa
  // en moveApplicationStage.
  const [{ data: application }, { data: competency }] = await Promise.all([
    supabase.from("applications").select("job_id").eq("id", applicationId).maybeSingle(),
    supabase.from("job_competencies").select("job_id").eq("id", competencyId).maybeSingle(),
  ]);
  if (!application || !competency) return { error: "No se encontró la postulación o la competencia." };
  if (application.job_id !== competency.job_id) {
    return { error: "Esa competencia no pertenece a la vacante de esta postulación." };
  }

  const { error } = await supabase.from("application_competency_scores").upsert(
    {
      organization_id: profile.organization_id,
      application_id: applicationId,
      competency_id: competencyId,
      evaluator_id: profile.id,
      score: parsed.data.score,
      comment: parsed.data.comment ?? null,
    },
    { onConflict: "application_id,competency_id,evaluator_id" },
  );
  if (error) return { error: "No se pudo guardar la calificación." };

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Calificación guardada" };
}
