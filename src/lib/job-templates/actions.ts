"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { JobTemplateSchema } from "./schema";
import { syncTemplateStagesFromPipeline } from "./sync-stages-from-pipeline";
import { assertBelongsToOrg } from "@/lib/assert-belongs-to-org";

export type JobTemplateActionResult = { error?: string; success?: string };

export async function createJobTemplate(
  _prevState: JobTemplateActionResult | undefined,
  formData: FormData,
): Promise<JobTemplateActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = JobTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa la plantilla." };

  const supabase = await createClient();

  const pipelineError = await assertBelongsToOrg(supabase, "pipeline_templates", parsed.data.pipeline_template_id, profile.organization_id, "Esa plantilla de pipeline no es válida.");
  if (pipelineError) return { error: pipelineError };

  const { data: template, error } = await supabase
    .from("job_templates")
    .insert({
      organization_id: profile.organization_id,
      // `status` default es 'draft' (Fase 18, pensado para el wizard paso a
      // paso) — este diálogo sigue siendo de un solo paso, todo el contenido
      // ya llegó completo en este mismo submit, así que nace publicada
      // directo. Sin esto, toda plantilla creada desde este diálogo quedaría
      // invisible para "Solicitar vacante" (getPublishedJobTemplates).
      status: "published",
      ...parsed.data,
    })
    .select("id")
    .single();
  if (error || !template) return { error: "No se pudo crear la plantilla." };

  // Este diálogo no tiene un paso "Etapas" propio como el wizard — sin
  // esto, job_template_stages quedaría vacía y createJob (Fase 18) rechaza
  // cualquier plantilla sin al menos una etapa.
  await syncTemplateStagesFromPipeline(profile.organization_id, template.id, parsed.data.pipeline_template_id ?? null);

  revalidatePath("/configuracion/plantillas-vacante");
  return { success: "Plantilla creada" };
}

export async function updateJobTemplate(
  templateId: string,
  _prevState: JobTemplateActionResult | undefined,
  formData: FormData,
): Promise<JobTemplateActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = JobTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa la plantilla." };

  const supabase = await createClient();

  const pipelineError = await assertBelongsToOrg(supabase, "pipeline_templates", parsed.data.pipeline_template_id, profile.organization_id, "Esa plantilla de pipeline no es válida.");
  if (pipelineError) return { error: pipelineError };

  // Se lee el pipeline ANTES de guardar — solo si de verdad cambió vale la
  // pena resincronizar job_template_stages. Sin este chequeo, guardar la
  // plantilla por cualquier otro motivo (ej. corregir un typo en la
  // descripción) borraría y reconstruiría las etapas cada vez, pisando
  // cualquier ajuste manual hecho después desde el paso "Etapas" del
  // wizard. Si SÍ cambió, no resincronizar dejaría job_template_stages con
  // las etapas del pipeline viejo — una vacante creada después heredaría un
  // kanban distinto al que el admin acaba de elegir, en silencio.
  const { data: before } = await supabase
    .from("job_templates")
    .select("pipeline_template_id")
    .eq("id", templateId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  const newPipelineId = parsed.data.pipeline_template_id ?? null;
  const pipelineChanged = before !== null && before.pipeline_template_id !== newPipelineId;

  const { error } = await supabase
    .from("job_templates")
    .update({
      ...parsed.data,
      // undefined en un .update() de Supabase omite la columna en vez de
      // limpiarla — si se quitó la plantilla de pipeline (vuelve a "Sin
      // asignar"), hay que mandar null explícito para que sí se borre.
      pipeline_template_id: newPipelineId,
    })
    .eq("id", templateId);
  if (error) return { error: "No se pudo actualizar la plantilla." };

  if (pipelineChanged) {
    await syncTemplateStagesFromPipeline(profile.organization_id, templateId, newPipelineId);
  }

  revalidatePath("/configuracion/plantillas-vacante");
  return { success: "Plantilla actualizada" };
}

export async function deleteJobTemplate(templateId: string): Promise<void> {
  await requireAdminOrAbove();
  const supabase = await createClient();
  const { error } = await supabase.from("job_templates").delete().eq("id", templateId);
  if (error) throw new Error("No se pudo eliminar la plantilla.");
  revalidatePath("/configuracion/plantillas-vacante");
}
