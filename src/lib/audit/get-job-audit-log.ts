import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type JobAuditLogRow = Tables<"audit_log"> & {
  actor: { display_name: string } | null;
};

/**
 * Bitácora de UNA vacante — "el resumen de los cambios que ha sufrido ese
 * registro" (decisión del usuario). RLS (`audit_log_select`, Fase 18 1/7)
 * ya filtra a quien tenga acceso a esa vacante (admin+, dueño, solicitante,
 * colaborador) — no hace falta un chequeo de rol aparte acá, un colaborador
 * sin acceso real a esta vacante recibe `[]` directo de la base, nunca una
 * fila que no debería ver.
 */
export async function getJobAuditLog(jobId: string): Promise<JobAuditLogRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("*, actor:profiles!audit_log_actor_id_fkey(display_name)")
    .eq("entity_type", "job")
    .eq("entity_id", jobId)
    .order("created_at", { ascending: false })
    .limit(100);
  return (data as JobAuditLogRow[]) ?? [];
}
