"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { RejectionReasonSchema } from "./schema";

export type RejectionReasonActionResult = { error?: string; success?: string };

export async function createRejectionReason(
  _prevState: RejectionReasonActionResult | undefined,
  formData: FormData,
): Promise<RejectionReasonActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = RejectionReasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa el motivo." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("rejection_reasons")
    .insert({ organization_id: profile.organization_id, label: parsed.data.label });
  if (error) {
    return { error: error.code === "23505" ? "Ya existe ese motivo." : "No se pudo crear." };
  }

  revalidatePath("/configuracion/motivos-rechazo");
  return { success: "Motivo agregado" };
}

/**
 * Nunca se borra un motivo — solo se desactiva. Postulaciones ya
 * rechazadas con este motivo (rejection_reason_id) deben poder seguir
 * mostrándolo; is_active solo controla si aparece como opción nueva.
 */
export async function toggleRejectionReason(id: string, isActive: boolean): Promise<RejectionReasonActionResult> {
  await requireAdminOrAbove();
  const supabase = await createClient();
  const { error } = await supabase.from("rejection_reasons").update({ is_active: isActive }).eq("id", id);
  if (error) return { error: "No se pudo actualizar." };

  revalidatePath("/configuracion/motivos-rechazo");
  return { success: isActive ? "Motivo activado" : "Motivo desactivado" };
}
