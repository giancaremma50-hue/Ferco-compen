import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Geist, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
import { MotionConfig } from "framer-motion";
import { getOrganization } from "@/lib/organizations/get-organization";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Demo AJE",
  description: "Plataforma de reclutamiento y seguimiento de candidatos.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Esto es lo que realmente aplica el acento configurable en toda la app,
  // no solo en la vista previa del configurador. getOrganization() está
  // memoizado con cache() — layout.tsx, páginas y componentes hijos que la
  // llamen dentro de la misma request comparten una sola consulta.
  const organization = await getOrganization();

  const accentStyle = organization
    ? ({ "--accent": organization.accent_color } as CSSProperties)
    : undefined;

  return (
    <html lang="es" style={accentStyle}>
      <body className={`${geist.variable} ${instrumentSerif.variable}`}>
        {/* reducedMotion="user" respeta prefers-reduced-motion también para
            las animaciones de framer-motion (transform/opacity vía WAAPI),
            que la regla CSS de arriba no puede alcanzar. */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
