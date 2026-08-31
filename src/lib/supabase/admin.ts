import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Cliente con service role: salta TODAS las políticas RLS.
 * Solo para el portal público (postulaciones) y tareas de servidor que
 * necesitan escribir fuera de la sesión de un usuario. Nunca importar
 * este archivo desde un client component.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
