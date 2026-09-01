"use client";

import { useEffect } from "react";
import { ERROR_CATALOG } from "@/lib/errors/catalog";
import { ErrorCard } from "@/components/errors/error-card";
import { ReportErrorDialog } from "@/components/errors/report-error-dialog";

const entry = ERROR_CATALOG.desconocido;

export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // Este console.error corre del lado del servidor cuando el error viene de
  // un Server Component/Server Function (React lo re-ejecuta ahí primero) —
  // es la única traza completa, ya que Next sanea `error.message` antes de
  // que cruce al cliente en producción (solo queda `digest` correlacionable).
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorCard entry={entry}>
      <button
        type="button"
        onClick={retry}
        className="inline-flex h-[42px] items-center justify-center rounded-md border border-primary bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Reintentar
      </button>
      {/* Este boundary siempre muestra ERROR_CATALOG.desconocido (reportable
          por diseño) — a diferencia de /auth/auth-error, `entry` aquí nunca
          varía, así que el diálogo siempre se monta, sin condición. */}
      <ReportErrorDialog title={entry.titulo} code="desconocido" error={error} />
    </ErrorCard>
  );
}
