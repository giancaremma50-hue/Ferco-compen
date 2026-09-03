import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";

export type CollaboratorPermission = Database["public"]["Enums"]["job_collaborator_permission"];

/**
 * Solo 2 niveles. Los 4 anteriores (viewer/interviewer/approver/owner) nunca
 * llegaron a exigirse — limitaban únicamente al rol `colaborador`, ya extinto
 * — y quedaron huérfanos en el enum de Postgres (no se pueden borrar valores).
 * Fuera de esta lista no existen para la interfaz.
 *
 * Estos 2 niveles describen a la gente que se SUMA a la vacante. El poder de
 * decidir (mover etapa, descartar, contratar, agendar, mensajear) no sale de
 * acá: sale de `jobs.owner_id` — ver `lib/applications/permissions.ts`.
 */
export const MEMBER_PERMISSIONS = ["solo_lectura", "lectura_escritura"] as const;
export type MemberPermission = (typeof MEMBER_PERMISSIONS)[number];

export const AddCollaboratorSchema = z.object({
  profile_id: z.uuid({ error: "Elige una persona." }),
  permission: z.enum(MEMBER_PERMISSIONS, { error: "Elige un nivel de acceso." }),
});

export const PERMISSION_LABEL: Record<CollaboratorPermission, string> = {
  lectura_escritura: "Lectura y escritura",
  solo_lectura: "Solo lectura",
  // Valores históricos, ya sin filas apuntando a ellos — se mapean a la
  // etiqueta equivalente para que una fila vieja jamás muestre un hueco.
  viewer: "Solo lectura",
  interviewer: "Lectura y escritura",
  approver: "Lectura y escritura",
  owner: "Lectura y escritura",
};

/** Qué puede hacer cada nivel, en una línea — se muestra junto al selector. */
export const PERMISSION_HINT: Record<MemberPermission, string> = {
  lectura_escritura: "Escribe seguimientos, deja tareas y califica. No mueve etapas ni edita la vacante.",
  solo_lectura: "Ve todo el registro: archivos, seguimientos y tareas. No escribe nada.",
};
