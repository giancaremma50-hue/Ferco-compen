"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { EmploymentReasonSchema } from "./schema";

export type EmploymentReasonActionResult = { error?: string; id?: string; label?: string };

/**
 * Alta inline desde el selector de "Motivo de la vacante" al crear una
 * vacante — a diferencia de rejection_reasons (admin-only), cualquier rol
 * que pueda crear una vacante puede agregar un motivo nuevo (RLS:
 * employment_reasons_insert). Es una lista operativa, no una política de
 * rechazo, y los 3 roles que existen pueden crear vacantes.
 */
export async function createEmploymentReason(
  _prevState: EmploymentReasonActionResult | undefined,
  formData: FormData,
): Promise<EmploymentReasonActionResult> {
  const profile = await requireProfile();
  const parsed = EmploymentReasonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa el motivo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("employment_reasons")
    .insert({ organization_id: profile.organization_id, label: parsed.data.label })
    .select("id, label")
    .single();

  if (error || !data) {
    return { error: error?.code === "23505" ? "Ese motivo ya existe." : "No se pudo agregar el motivo." };
  }

  revalidatePath("/vacantes/nueva");
  return { id: data.id, label: data.label };
}
