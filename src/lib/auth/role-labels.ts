import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/**
 * Única fuente de verdad para el nombre visible de cada rol.
 *
 * `colaborador` sigue acá porque este `Record` es exhaustivo sobre el enum y
 * Postgres no permite borrar un valor de un enum — no porque el rol se use.
 * Para saber qué se puede ASIGNAR, usar `ASSIGNABLE_ROLES`, nunca las llaves
 * de este objeto.
 */
export const ROLE_LABEL: Record<AppRole, string> = {
  colaborador: "Colaborador",
  gestor: "Gestor",
  admin: "Admin",
  super_admin: "Super admin",
};

/**
 * Los roles que un humano puede elegir, en orden de menor a mayor.
 *
 * Lista blanca a propósito, no `Object.keys(ROLE_LABEL)`: derivarla del enum
 * hacía que `colaborador` —un rol eliminado del producto— apareciera solo en
 * todo desplegable, y encima como opción por defecto. Mismo principio que
 * `WRITE_PERMISSIONS` en `lib/jobs/collaborators-schema.ts`: un valor del
 * enum no se vuelve asignable por accidente, hay que escribirlo acá.
 */
export const ASSIGNABLE_ROLES = ["gestor", "admin", "super_admin"] as const satisfies readonly AppRole[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** El rol de menor privilegio que se puede asignar — el default de todo formulario. */
export const DEFAULT_ROLE: AssignableRole = "gestor";

/** Única fuente de verdad para "es admin o superior" — evita que cada
 * archivo redeclare su propio Set y se desincronicen entre sí. */
export const ADMIN_ROLES = new Set<AppRole>(["admin", "super_admin"]);
