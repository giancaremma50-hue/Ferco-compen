import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// En Next.js 16 el archivo se llama proxy.ts (antes middleware.ts) — misma
// función, otro nombre. Ver .claude/napkin.md.
//
// Nonce de CSP por request — ver
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
// Solo funciona con rendering 100% dinámico, que ya es el caso de esta app
// entera (toda página depende de la sesión de Supabase), así que no cuesta
// nada de lo que el proyecto ya tenía.
//
// `style-src` queda con 'unsafe-inline' a propósito, no por descuido: el
// acento configurable por organización (regla de diseño de AGENTS.md) se
// aplica hoy con `style={{...}}` inline en decenas de puntos (marca,
// wizard, vista previa) porque el valor es dinámico en tiempo de ejecución
// — nonce-ar cada uno sería una migración grande y arriesgada de verificar
// sin navegador real disponible en este entorno. `script-src` sí queda
// estricto (nonce + strict-dynamic, sin 'unsafe-inline' ni 'unsafe-eval' en
// producción) — es la directiva que de verdad frena la ejecución de script
// inyectado, la amenaza principal que CSP existe para frenar.
function buildCsp(nonce: string) {
  const isDev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://*.supabase.co https://*.googleusercontent.com",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const response = await updateSession(request, { nonce, csp });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
