import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import type { JobStatus } from "./schema";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** Único lugar donde vive qué estados ya no aceptan más acción. */
export const TERMINAL_JOB_STATUSES = new Set<JobStatus>(["cerrada", "cancelada"]);

/** Espeja jobs_update en RLS: admin+ siempre, o el solicitante mientras siga en borrador. */
export function canEditJob(
  actorRole: AppRole,
  actorId: string,
  job: { requested_by: string | null; status: JobStatus },
): boolean {
  return ADMIN_ROLES.has(actorRole) || (job.requested_by === actorId && job.status === "borrador");
}
