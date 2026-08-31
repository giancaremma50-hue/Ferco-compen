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
  images: {
    remotePatterns: [
      // Logos y portadas servidas desde el bucket público de marca.
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
    ],
    // Sin dangerouslyAllowSVG a propósito: el configurador de marca no
    // admite subir SVG (ver src/lib/organizations/actions.ts) precisamente
    // para no tener que sandboxear nada aquí.
  },
};

export default nextConfig;
