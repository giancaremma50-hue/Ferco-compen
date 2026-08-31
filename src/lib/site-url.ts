import "server-only";
import { headers } from "next/headers";

/**
 * Deriva la URL del sitio del host real de la request cuando falta la
 * variable de entorno — fácil de olvidar en un deploy nuevo de Vercel, y
 * caer en localhost rompería el login/enlaces para todos en silencio.
 *
 * El único uso sensible de esto es signInWithGoogle(), que la pasa como
 * `redirectTo` a Supabase Auth. Un Host falsificado no basta para explotar
 * eso: Supabase valida `redirectTo` contra la lista de "Redirect URLs"
 * configurada en el proyecto y rechaza cualquier valor fuera de esa lista
 * — esa es la barrera real, no esta función.
 */
export async function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;

  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}
