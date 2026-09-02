import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { StageType } from "./schema";

export type PipelineTemplateWithStages = { id: string; name: string; stages: { title: string; type: StageType }[] };

/**
 * Para el paso "Etapas" del wizard de plantillas de vacante — el <select>
 * "Empezar desde un set guardado" necesita las etapas de TODAS las
 * plantillas de pipeline de la organización de una vez (son pocas, sin
 * paginación), para no pedirle al servidor una por cada cambio del select.
 */
export async function getPipelineTemplatesWithStages(organizationId: string): Promise<PipelineTemplateWithStages[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_templates")
    .select("id, name, pipeline_template_stages(name, type, position)")
    .eq("organization_id", organizationId)
    .order("name")
    .order("position", { referencedTable: "pipeline_template_stages" });

  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    stages: (t.pipeline_template_stages ?? []).map((s) => ({ title: s.name, type: s.type })),
  }));
}

