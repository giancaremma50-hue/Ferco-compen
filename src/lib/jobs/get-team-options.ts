import "server-only";
import { createClient } from "@/lib/supabase/server";

export type TeamMemberOption = { id: string; display_name: string };

/**
 * Para los selectores de "Reclutador asignado" (acceptJobRequest, al
 * aceptar una solicitud) y "Admins adicionales" (createJob, cuando quien
 * crea es admin+) — `jobs.owner_id` siempre fue admin+ en este proyecto.
 */
export async function getOrgAdmins(organizationId: string): Promise<TeamMemberOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .in("role", ["admin", "super_admin"])
    .order("display_name");
  return data ?? [];
}

/** Para "colaboradores adicionales" — cualquier miembro activo, cualquier rol (job_collaborators no restringe por rol). */
export async function getOrgMembers(organizationId: string): Promise<TeamMemberOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .order("display_name");
  return data ?? [];
}
