import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { CollaboratorPermission } from "@/lib/jobs/collaborators-schema";

type AppRole = Database["public"]["Enums"]["app_role"];

const CAN_DECIDE = new Set<CollaboratorPermission>(["approver", "owner"]);
const CAN_RATE = new Set<CollaboratorPermission>(["interviewer", "approver", "owner"]);

/**
 * Acceso fino por job_collaborators (AGENTS.md: "no subiendo el rol
 * global"). RLS ya deja pasar a CUALQUIER colaborador (`can_access_job`
 * no distingue `permission`) — esta es la capa que sí distingue, para
 * decisiones (rechazar/contratar/mover etapa) y calificar.
 * `gestor`/`admin`/`super_admin` siguen su propio criterio de siempre
 * (rol global), sin tocar job_collaborators — solo un `colaborador`
 * necesita el nivel correcto.
 */
async function getCollaboratorPermission(jobId: string, profileId: string): Promise<CollaboratorPermission | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_collaborators")
    .select("permission")
    .eq("job_id", jobId)
    .eq("profile_id", profileId)
    .maybeSingle();
  return data?.permission ?? null;
}

async function hasCollaboratorPermission(
  actorRole: AppRole,
  actorId: string,
  jobId: string,
  allowed: Set<CollaboratorPermission>,
): Promise<boolean> {
  if (actorRole !== "colaborador") return true;
  const permission = await getCollaboratorPermission(jobId, actorId);
  return permission !== null && allowed.has(permission);
}

export function canDecideApplication(actorRole: AppRole, actorId: string, jobId: string): Promise<boolean> {
  return hasCollaboratorPermission(actorRole, actorId, jobId, CAN_DECIDE);
}

export function canRateApplication(actorRole: AppRole, actorId: string, jobId: string): Promise<boolean> {
  return hasCollaboratorPermission(actorRole, actorId, jobId, CAN_RATE);
}
