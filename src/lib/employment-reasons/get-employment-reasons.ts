import "server-only";
import { createClient } from "@/lib/supabase/server";

export type EmploymentReasonOption = { id: string; label: string };

/** Catálogo de "Motivo de la vacante" — lectura para cualquier miembro de la organización (RLS: employment_reasons_select). */
export async function getEmploymentReasons(organizationId: string): Promise<EmploymentReasonOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employment_reasons")
    .select("id, label")
    .eq("organization_id", organizationId)
    .order("label");
  return data ?? [];
}
