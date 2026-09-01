import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Copia una plantilla de pipeline a job_stages en el momento de crear la
 * vacante — así editar la plantilla después no altera procesos en curso.
 * También deja jobs.pipeline_template_id apuntando a la plantilla usada,
 * para que Fase 5 sepa de dónde salió el pipeline. Si `pipelineTemplateId`
 * viene de una plantilla de vacante (Fase 15), se usa esa; si no, la
 * predeterminada de la organización — mismo comportamiento de siempre.
 *
 * Usa el cliente admin a propósito: pipeline_templates y job_stages solo
 * tienen políticas de escritura/lectura para admin+ (pipeline_templates_admin,
 * job_stages_write_admin) — un gestor, que sí puede crear una vacante propia,
 * no tiene SELECT sobre pipeline_templates en absoluto. Con el cliente de
 * sesión, la vacante del gestor se crearía sin ningún pipeline porque la
 * consulta de la plantilla por defecto vuelve vacía por RLS, no porque no
 * exista.
 */
export async function materializeJobStages(
  jobId: string,
  organizationId: string,
  pipelineTemplateId?: string | null,
): Promise<{ error?: string }> {
  const admin = createAdminClient();

  // .eq("organization_id", ...) además de .eq("id", ...) cuando viene de una
  // plantilla de vacante: no confiar en que el id ya fue validado más arriba
  // en la cadena de llamadas — este archivo no sabe de dónde vino el valor.
  let templateQuery = admin.from("pipeline_templates").select("id").eq("organization_id", organizationId);
  templateQuery = pipelineTemplateId ? templateQuery.eq("id", pipelineTemplateId) : templateQuery.eq("is_default", true);
  const { data: template } = await templateQuery.single();

  if (!template) return { error: "No hay una plantilla de pipeline configurada para tu organización." };

  const { data: stages, error: stagesError } = await admin
    .from("pipeline_template_stages")
    .select("name, type, position")
    .eq("pipeline_template_id", template.id)
    .order("position");

  if (stagesError || !stages || stages.length === 0) {
    return { error: "La plantilla de pipeline no tiene etapas configuradas." };
  }

  const rows = stages.map((s) => ({
    job_id: jobId,
    organization_id: organizationId,
    name: s.name,
    type: s.type,
    position: s.position,
  }));

  const { error: insertError } = await admin.from("job_stages").insert(rows);
  if (insertError) return { error: "No se pudo preparar el pipeline de esta vacante." };

  await admin.from("jobs").update({ pipeline_template_id: template.id }).eq("id", jobId);

  return {};
}
