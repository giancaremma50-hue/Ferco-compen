"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { ERROR_CATALOG } from "@/lib/errors/catalog";

// global-error reemplaza el root layout cuando se activa: debe declarar sus
// propios <html> y <body>, y no tiene acceso a Tailwind/globals.css (por
// eso los estilos inline) — sin diálogo de reporte aquí, ReportErrorDialog
// depende de esas clases. El caso real (fallo en el root layout) es raro y
// crítico; error.tsx cubre el reporte para todo lo demás.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const entry = ERROR_CATALOG.desconocido;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui, sans-serif", background: "#faf9f7", color: "#14140f" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 24px" }}>
          <div style={{ border: "1px solid #e4e1da", background: "#fff", padding: 44 }}>
            <div style={{ marginBottom: 20, display: "flex", width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: "9999px", border: "1px solid #b3261e" }}>
              <AlertTriangle size={20} color="#b3261e" aria-hidden />
            </div>
            <h1 style={{ fontFamily: "Georgia, serif", fontSize: 28, lineHeight: 1.2, margin: 0 }}>{entry.titulo}</h1>
            <p style={{ marginTop: 14, fontSize: 15, lineHeight: 1.6 }}>{entry.mensaje}</p>
            <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.6, color: "#6b6862" }}>{entry.queHacer}</p>
            <button
              type="button"
              onClick={retry}
              style={{ marginTop: 28, height: 42, padding: "0 20px", background: "#14140f", border: "1px solid #14140f", borderRadius: 6, color: "#faf9f7", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
