"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { JobTemplateSchema } from "./schema";

export type JobTemplateActionResult = { error?: string; success?: string };

export async function createJobTemplate(
  _prevState: JobTemplateActionResult | undefined,
  formData: FormData,
): Promise<JobTemplateActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = JobTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa la plantilla." };

  const supabase = await createClient();
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
  await requireAdminOrAbove();
  const parsed = JobTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa la plantilla." };

  const supabase = await createClient();
  const { error } = await supabase.from("job_templates").update(parsed.data).eq("id", templateId);
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
