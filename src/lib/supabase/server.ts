import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

/**
 * Cliente del servidor con la sesión del usuario: respeta RLS.
 * Se crea uno nuevo por request (Server Component / Server Action) porque
 * lleva las cookies de esa request específica.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Ignorado a propósito: un Server Component no puede escribir
            // cookies. El proxy.ts se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
