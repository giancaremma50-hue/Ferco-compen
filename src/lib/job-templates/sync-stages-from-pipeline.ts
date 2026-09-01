import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { StageType } from "@/lib/pipeline-templates/schema";

const RESERVED_TYPES = new Set<StageType>(["postulado", "contratado", "descartado"]);

/**
 * Puebla `job_template_stages` a partir de un `pipeline_template` elegido en
 * el diálogo plano de Fase 15 (`JobTemplateDialog`) — ese diálogo no tiene
 * un paso "Etapas" propio como el wizard (Fase 18), así que sin esto una
 * plantilla creada ahí nunca tendría etapas, y `createJob` exige al menos
 * una para poder copiarlas a `job_stages`.
 *
 * Sin `pipelineTemplateId` (el campo es opcional en el diálogo), usa la
 * plantilla de pipeline predeterminada de la organización — mismo
 * comportamiento que `materializeJobStages` tenía antes de esta fase
 * ("si no eliges una, la vacante nace con la predeterminada").
 *
 * Mismas reglas que el paso "Etapas" del wizard: Bandeja de entrada /
 * Contratado / Descartado fijas; las etapas intermedias del pipeline
 * elegido se copian excluyendo las que ya ocupan esos 3 tipos reservados
 * (si el pipeline ya termina en "Contratado", esa etapa no se duplica).
 */
export async function syncTemplateStagesFromPipeline(
  organizationId: string,
  jobTemplateId: string,
  pipelineTemplateId: string | null,
): Promise<void> {
  // createAdminClient() bypasea RLS — cada consulta se filtra por
  // organization_id explícito acá, no se confía en que el único llamador de
  // hoy (updateJobTemplate/createJobTemplate) ya haya validado el id antes
  // de llegar. Defensa en profundidad: un futuro llamador que no valide
  // primero no debe poder copiar el pipeline de otra organización.
  const admin = createAdminClient();

  await admin.from("job_template_stages").delete().eq("job_template_id", jobTemplateId).eq("organization_id", organizationId);

  let sourcePipelineId = pipelineTemplateId;
  if (!sourcePipelineId) {
    const { data: defaultPipeline } = await admin
      .from("pipeline_templates")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("is_default", true)
      .maybeSingle();
    sourcePipelineId = defaultPipeline?.id ?? null;
  }

  let middle: { title: string; type: StageType }[] = [];
  if (sourcePipelineId) {
    const { data } = await admin
      .from("pipeline_template_stages")
      .select("name, type")
      .eq("pipeline_template_id", sourcePipelineId)
      .eq("organization_id", organizationId)
      .order("position");
    middle = (data ?? [])
      .filter((s) => !RESERVED_TYPES.has(s.type))
      .map((s) => ({ title: s.name, type: s.type }));
  }

  const rows = [
    { title: "Bandeja de entrada", type: "postulado" as const },
    ...middle,
    { title: "Contratado", type: "contratado" as const },
    { title: "Descartado", type: "descartado" as const },
  ].map((s, i) => ({
    organization_id: organizationId,
    job_template_id: jobTemplateId,
    title: s.title,
    type: s.type,
    position: i,
  }));

  await admin.from("job_template_stages").insert(rows);
}
