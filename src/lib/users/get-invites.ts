import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type PendingInvite = {
  id: string;
  email: string;
  role: Database["public"]["Enums"]["app_role"];
  createdAt: string;
};

/**
 * RLS (profile_invites_super_admin) ya limita esto a super admin de la
 * organización — el filtro explícito es defensa en profundidad, igual que
 * el resto de lecturas de /configuracion/usuarios.
 */
export async function getPendingInvites(organizationId: string): Promise<PendingInvite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profile_invites")
    .select("id, email, role, created_at")
    // consumed_at no nulo = esa persona ya entró y su rol ya quedó
    // asignado — la fila sigue existiendo como exención permanente del
    // filtro de dominio (ver auth/callback), pero ya no es "pendiente".
    .is("consumed_at", null)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((i) => ({ id: i.id, email: i.email, role: i.role, createdAt: i.created_at }));
}
