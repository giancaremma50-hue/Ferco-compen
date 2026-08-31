/**
 * Solo rutas relativas al propio sitio. Sin esto, un `proximo` como
 * "/login?proximo=@evil.com" o "//evil.com" termina en un open redirect
 * después de un login real de Google.
 *
 * `searchParams` de Next.js entrega `string[]` cuando la clave se repite en
 * la URL (?proximo=/a&proximo=/b) — se acepta ese tipo también para que
 * nunca truene con un TypeError, aunque el resultado sea el mismo: se
 * descarta y se usa el fallback.
 */
export function sanitizeRedirectPath(
  path: string | string[] | null | undefined,
  fallback = "/inicio",
): string {
  if (typeof path !== "string" || path.length === 0) return fallback;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return fallback;
  }
  return path;
}
