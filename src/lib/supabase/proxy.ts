import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "./database.types";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";

const PUBLIC_PATHS = ["/login", "/auth", "/empleos"];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Copia las cookies de sesión (posiblemente refrescadas) a la respuesta final. */
function withSessionCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    target.cookies.set(cookie);
  }
  return target;
}

/**
 * Chequeo optimista, no la capa de seguridad real (esa vive en RLS + el
 * Data Access Layer). Solo refresca la cookie de sesión y redirige rápido
 * antes de tocar la base de datos. Corre en Node.js runtime (no Edge), así
 * que puede usar el SDK completo de Supabase sin problema.
 *
 * `cspNonce`, si llega, se mete en cada respuesta como header de request
 * (`x-nonce` + `Content-Security-Policy`) — es lo que hace que
 * `(await headers()).get("x-nonce")` funcione en cualquier Server Component
 * más adelante en el pipeline. Se reconstruye desde `request.headers` cada
 * vez que se arma una respuesta nueva (no una sola vez al principio) porque
 * `setAll()` de abajo muta las cookies del `request` original después de
 * que empieza esta función — una copia de headers tomada al inicio se
 * quedaría con el Cookie header viejo.
 */
export async function updateSession(
  request: NextRequest,
  cspNonce?: { nonce: string; csp: string },
) {
  function nextResponse() {
    const headers = new Headers(request.headers);
    if (cspNonce) {
      headers.set("x-nonce", cspNonce.nonce);
      headers.set("Content-Security-Policy", cspNonce.csp);
    }
    return NextResponse.next({ request: { headers } });
  }

  let response = nextResponse();

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = nextResponse();
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // getUser() puede haber refrescado el token y dejado cookies nuevas en
  // `response` — toda redirección de aquí en adelante debe llevárselas,
  // o el navegador se queda con un refresh token ya rotado por el servidor.
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("proximo", sanitizeRedirectPath(pathname));
    return withSessionCookies(NextResponse.redirect(url), response);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/inicio";
    url.search = "";
    return withSessionCookies(NextResponse.redirect(url), response);
  }

  return response;
}
