import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type AuditLogRow = Tables<"audit_log"> & {
  actor: { display_name: string } | null;
};

/**
 * `audit_log_select_super_admin` es solo `is_super_admin()` — sin chequeo
 * de organización (mismo patrón que error_reports, ver napkin.md). Se
 * acota aquí también mientras esa política no se corrija.
 */
export async function getAuditLog(organizationId: string): Promise<AuditLogRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("*, actor:profiles!audit_log_actor_id_fkey(display_name)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  return (data as AuditLogRow[]) ?? [];
}
