import "server-only";
import { createClient } from "@/lib/supabase/server";

export type DepartmentOption = { id: string; name: string };

/** Compartida entre /vacantes/nueva y /vacantes/[id]/editar — mismo selector. */
export async function getDepartmentsForOrg(): Promise<DepartmentOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("departments").select("id, name").order("name");
  return data ?? [];
}
