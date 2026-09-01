"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { JobTemplateSchema } from "./schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type JobTemplateActionResult = { error?: string; success?: string };

/**
 * El <select> del formulario ya solo ofrece plantillas de pipeline de la
 * propia organización, pero una Server Action es un endpoint de red — nada
 * impide un POST fabricado a mano con el id de una plantilla de otra
 * organización. Mismo patrón que assertValidDepartment en jobs/actions.ts.
 */
async function assertValidPipelineTemplate(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  pipelineTemplateId: string | undefined,
): Promise<string | null> {
  if (!pipelineTemplateId) return null;
  const { data } = await supabase
    .from("pipeline_templates")
    .select("id")
    .eq("id", pipelineTemplateId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data ? null : "Esa plantilla de pipeline no es válida.";
}

export async function createJobTemplate(
  _prevState: JobTemplateActionResult | undefined,
  formData: FormData,
): Promise<JobTemplateActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = JobTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa la plantilla." };

  const supabase = await createClient();

  const pipelineError = await assertValidPipelineTemplate(supabase, profile.organization_id, parsed.data.pipeline_template_id);
  if (pipelineError) return { error: pipelineError };

  const { error } = await supabase.from("job_templates").insert({
    organization_id: profile.organization_id,
    ...parsed.data,
  });
  if (error) return { error: "No se pudo crear la plantilla." };

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

  const pipelineError = await assertValidPipelineTemplate(supabase, profile.organization_id, parsed.data.pipeline_template_id);
  if (pipelineError) return { error: pipelineError };

  const { error } = await supabase
    .from("job_templates")
    .update({
      ...parsed.data,
      // undefined en un .update() de Supabase omite la columna en vez de
      // limpiarla — si se quitó la plantilla de pipeline (vuelve a "Sin
      // asignar"), hay que mandar null explícito para que sí se borre.
      pipeline_template_id: parsed.data.pipeline_template_id ?? null,
    })
    .eq("id", templateId);
  if (error) return { error: "No se pudo actualizar la plantilla." };

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
