import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type PipelineTemplateRow = Tables<"pipeline_templates"> & { stage_count: number };
export type PipelineTemplateStageRow = Tables<"pipeline_template_stages">;

export async function getPipelineTemplates(organizationId: string): Promise<PipelineTemplateRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pipeline_templates")
    .select("*, pipeline_template_stages(count)")
    .eq("organization_id", organizationId)
    .order("name");
  return (data ?? []).map((t) => ({
    ...t,
    stage_count: (t.pipeline_template_stages as unknown as { count: number }[])[0]?.count ?? 0,
    pipeline_template_stages: undefined,
  })) as PipelineTemplateRow[];
}

export async function getPipelineTemplate(
  id: string,
): Promise<{ template: Tables<"pipeline_templates">; stages: PipelineTemplateStageRow[] } | null> {
  const supabase = await createClient();
  const [{ data: template }, { data: stages }] = await Promise.all([
    supabase.from("pipeline_templates").select("*").eq("id", id).maybeSingle(),
    supabase.from("pipeline_template_stages").select("*").eq("pipeline_template_id", id).order("position"),
  ]);
  if (!template) return null;
  return { template, stages: stages ?? [] };
}
