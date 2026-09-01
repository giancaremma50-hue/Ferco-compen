import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";

export type CollaboratorPermission = Database["public"]["Enums"]["job_collaborator_permission"];

export const AddCollaboratorSchema = z.object({
  profile_id: z.uuid({ error: "Elige una persona." }),
  permission: z.enum(["viewer", "interviewer", "approver", "owner"], { error: "Elige un nivel de acceso." }),
});

export const PERMISSION_LABEL: Record<CollaboratorPermission, string> = {
  viewer: "Solo ver",
  interviewer: "Entrevistador — puede calificar",
  approver: "Aprobador — puede decidir",
  owner: "Dueño — control total de esta vacante",
};
