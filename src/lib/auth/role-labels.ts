import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

/** Única fuente de verdad para el nombre visible de cada rol. */
export const ROLE_LABEL: Record<AppRole, string> = {
  colaborador: "Colaborador",
  gestor: "Gestor",
  admin: "Admin",
  super_admin: "Super admin",
};

/** Única fuente de verdad para "es admin o superior" — evita que cada
 * archivo redeclare su propio Set y se desincronicen entre sí. */
export const ADMIN_ROLES = new Set<AppRole>(["admin", "super_admin"]);
