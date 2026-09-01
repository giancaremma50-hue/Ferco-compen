import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type DepartmentAdminRow = Tables<"departments"> & {
  head: { display_name: string } | null;
};

export async function getDepartmentsAdmin(organizationId: string): Promise<DepartmentAdminRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("departments")
    .select("*, head:profiles!departments_head_profile_id_fkey(display_name)")
    .eq("organization_id", organizationId)
    .order("name");
  return (data as DepartmentAdminRow[]) ?? [];
}

export type SelectableProfile = { id: string; display_name: string };

/** Para el selector de "responsable" del formulario — cualquier persona activa de la org. */
export async function getProfilesForSelect(organizationId: string): Promise<SelectableProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("display_name");
  return data ?? [];
}
