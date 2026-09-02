import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad aplicadas a toda respuesta.
 * HSTS solo tiene efecto sobre HTTPS; en local el navegador lo ignora.
 */
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    // Default es 1 MB — el configurador de marca admite imágenes de hasta
    // 5 MB (ver MAX_IMAGE_BYTES en src/lib/organizations/actions.ts); sin
    // este override, cualquier "imagen de inicio de sesión" real (recomendada
    // 1200x1600 vertical) pasa el chequeo de la Server Action pero Next.js la
    // rechaza antes de que ese código corra.
    serverActions: { bodySizeLimit: "6mb" },
  },
  images: {
    remotePatterns: [
      // Logos, portadas y fotos de perfil subidas, servidas desde buckets
      // públicos de Supabase Storage.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      // Foto de perfil de Google, la que trae la cuenta por defecto antes
      // de que alguien suba una propia — sin este patrón, next/image
      // bloquea el host y avatar_url nunca se muestra para nadie que no
      // haya subido su propia foto todavía.
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
    // Sin dangerouslyAllowSVG a propósito: el configurador de marca no
    // admite subir SVG (ver src/lib/organizations/actions.ts) precisamente
    // para no tener que sandboxear nada aquí.
  },
};

export default nextConfig;
