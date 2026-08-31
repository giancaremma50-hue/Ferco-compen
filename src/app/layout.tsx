import type { Metadata } from "next";
import { Geist, Instrument_Serif } from "next/font/google";
import { Toaster } from "sonner";
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
  title: "Reclutamiento",
  description: "Plataforma de reclutamiento y seguimiento de candidatos.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geist.variable} ${instrumentSerif.variable}`}>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
