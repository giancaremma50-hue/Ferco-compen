"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AddCollaboratorSchema } from "./collaborators-schema";

export type CollaboratorActionResult = { error?: string; success?: string };

export async function addJobCollaborator(
  jobId: string,
  _prevState: CollaboratorActionResult | undefined,
  formData: FormData,
): Promise<CollaboratorActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = AddCollaboratorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const supabase = await createClient();

  // El cliente nunca es fuente de verdad: profile_id llega como texto de un
  // <select>, sin garantía de que sea alguien de ESTA organización — el
  // <select> del panel ya lo filtra, pero un POST directo a esta action no
  // pasa por ahí. Confirmar server-side antes de insertar.
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", parsed.data.profile_id)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (!targetProfile) return { error: "Esa persona no pertenece a tu organización." };

  const { error } = await supabase.from("job_collaborators").insert({
    organization_id: profile.organization_id,
    job_id: jobId,
    profile_id: parsed.data.profile_id,
    permission: parsed.data.permission,
  });
  if (error) {
    // UNIQUE(job_id, profile_id) — mensaje concreto en vez del genérico de abajo.
    return { error: error.code === "23505" ? "Esa persona ya es colaboradora de esta vacante." : "No se pudo agregar." };
  }

  revalidatePath(`/vacantes/${jobId}`);
  return { success: "Colaborador agregado" };
}

export async function removeJobCollaborator(collaboratorId: string, jobId: string): Promise<void> {
  await requireAdminOrAbove();
  const supabase = await createClient();
  const { error } = await supabase.from("job_collaborators").delete().eq("id", collaboratorId);
  if (error) throw new Error("No se pudo eliminar al colaborador.");
  revalidatePath(`/vacantes/${jobId}`);
}
