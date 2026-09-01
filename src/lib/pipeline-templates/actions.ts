"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { PipelineTemplateSchema, type StageType } from "./schema";

export type PipelineTemplateActionResult = { error?: string; success?: string };

function mapStagesForInsert(
  stages: { name: string; type: StageType }[],
  organizationId: string,
  templateId: string,
) {
  return stages.map((s, i) => ({
    organization_id: organizationId,
    pipeline_template_id: templateId,
    name: s.name,
    type: s.type,
    position: i,
  }));
}

export async function createPipelineTemplate(
  _prevState: PipelineTemplateActionResult | undefined,
  formData: FormData,
): Promise<PipelineTemplateActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = PipelineTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const supabase = await createClient();
  const { data: template, error } = await supabase
    .from("pipeline_templates")
    .insert({ organization_id: profile.organization_id, name: parsed.data.name })
    .select("id")
    .single();
  if (error || !template) {
    return { error: error?.code === "23505" ? "Ya existe una plantilla con ese nombre." : "No se pudo crear." };
  }

  const { error: stagesError } = await supabase
    .from("pipeline_template_stages")
    .insert(mapStagesForInsert(parsed.data.stages, profile.organization_id, template.id));
  if (stagesError) {
    // La plantilla ya se creó pero sin etapas — mejor que quede sin
    // etapas y visible para corregir, que perder el nombre elegido.
    return { error: "La plantilla se creó, pero no se pudieron guardar las etapas. Edítala para agregarlas." };
  }

  revalidatePath("/configuracion/pipelines");
  redirect(`/configuracion/pipelines/${template.id}`);
}

export async function updatePipelineTemplate(
  id: string,
  _prevState: PipelineTemplateActionResult | undefined,
  formData: FormData,
): Promise<PipelineTemplateActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = PipelineTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const supabase = await createClient();

  // Mismo patrón que otras listas anidadas del proyecto (preguntas/etapas
  // de vacante): se reemplaza completo, nunca se hace diff — más simple
  // y esta pantalla no la usa nadie con la frecuencia suficiente para que
  // el costo de un borra+reinserta importe. El rename no depende del
  // borrado de etapas, así que van en paralelo.
  const [{ error: renameError }] = await Promise.all([
    supabase.from("pipeline_templates").update({ name: parsed.data.name }).eq("id", id),
    supabase.from("pipeline_template_stages").delete().eq("pipeline_template_id", id),
  ]);
  if (renameError) {
    return { error: renameError.code === "23505" ? "Ya existe una plantilla con ese nombre." : "No se pudo guardar." };
  }

  const { error: stagesError } = await supabase
    .from("pipeline_template_stages")
    .insert(mapStagesForInsert(parsed.data.stages, profile.organization_id, id));
  if (stagesError) return { error: "No se pudieron guardar las etapas." };

  revalidatePath("/configuracion/pipelines");
  revalidatePath(`/configuracion/pipelines/${id}`);
  return { success: "Plantilla guardada" };
}

export async function deletePipelineTemplate(id: string): Promise<void> {
  await requireAdminOrAbove();
  const supabase = await createClient();

  // Compare-and-swap: is_default=false va en el propio WHERE del DELETE,
  // no en un SELECT previo — si otro admin la marcó predeterminada entre
  // que esta pantalla cargó y este clic, el DELETE no afecta ninguna fila
  // en vez de borrar por error la plantilla predeterminada.
  const { data, error } = await supabase
    .from("pipeline_templates")
    .delete()
    .eq("id", id)
    .eq("is_default", false)
    .select("id")
    .maybeSingle();
  if (error) throw new Error("No se pudo eliminar la plantilla.");
  if (!data) {
    throw new Error("No puedes eliminar la plantilla predeterminada — marca otra como predeterminada primero.");
  }
  revalidatePath("/configuracion/pipelines");
}

export async function setDefaultPipelineTemplate(id: string): Promise<PipelineTemplateActionResult> {
  const profile = await requireAdminOrAbove();
  const supabase = await createClient();

  // Se quita el default actual ANTES de poner el nuevo — el índice único
  // parcial (organization_id) WHERE is_default no deja tener dos a la vez.
  // organization_id sale del perfil autenticado, nunca de un parámetro que
  // pudiera llegar manipulado desde el cliente.
  const { error: unsetError } = await supabase
    .from("pipeline_templates")
    .update({ is_default: false })
    .eq("organization_id", profile.organization_id)
    .eq("is_default", true);
  if (unsetError) return { error: "No se pudo actualizar la plantilla predeterminada." };

  const { error: setError } = await supabase.from("pipeline_templates").update({ is_default: true }).eq("id", id);
  if (setError) return { error: "No se pudo marcar como predeterminada." };

  revalidatePath("/configuracion/pipelines");
  return { success: "Plantilla marcada como predeterminada" };
}
