"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type ApplicationActionResult = { error?: string; success?: string };

export async function moveApplicationStage(
  applicationId: string,
  fromStageId: string,
  toStageId: string,
): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  if (profile.role === "colaborador") return { error: "Tu perfil no puede mover postulaciones." };
  if (fromStageId === toStageId) return { success: "Sin cambios" };

  const supabase = await createClient();

  // Compare-and-swap: si alguien más ya la movió desde que esta pantalla
  // cargó, `fromStageId` ya no coincide con la fila real y el UPDATE no
  // afecta nada — evita que dos arrastres simultáneos se pisen en silencio
  // (mismo patrón que las transiciones de estado de vacantes en Fase 4).
  const { data, error } = await supabase
    .from("applications")
    .update({ stage_id: toStageId, stage_changed_at: new Date().toISOString(), stage_changed_by: profile.id })
    .eq("id", applicationId)
    .eq("stage_id", fromStageId)
    .select("id, organization_id")
    .single();

  if (error || !data) {
    return { error: "Alguien más ya movió esta postulación. Actualiza la página." };
  }

  await supabase.from("application_events").insert({
    organization_id: data.organization_id,
    application_id: applicationId,
    type: "etapa_cambiada",
    actor_id: profile.id,
    payload: { from: fromStageId, to: toStageId },
  });

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Etapa actualizada" };
}
