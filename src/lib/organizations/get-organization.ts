import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * organizations es de lectura pública (RLS using true), así que esto sirve
 * tanto para /login (sin sesión) como para el resto de la app. cache()
 * evita que layout.tsx, la página y componentes hijos repitan la misma
 * consulta dentro de la misma request.
 */
export const getOrganization = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("*")
    .eq("slug", "principal")
    .single();
  return data;
});
