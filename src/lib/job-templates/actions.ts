"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export async function deleteJobTemplate(templateId: string): Promise<void> {
  await requireAdminOrAbove();
  const supabase = await createClient();
  const { error } = await supabase.from("job_templates").delete().eq("id", templateId);
  if (error) throw new Error("No se pudo eliminar la plantilla.");
  revalidatePath("/configuracion/plantillas-vacante");
}
