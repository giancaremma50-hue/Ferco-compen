import { AlertTriangle } from "lucide-react";
import type { ErrorEntry } from "@/lib/errors/catalog";
import { ReportErrorDialog } from "@/components/errors/report-error-dialog";

/**
 * Markup compartido por src/app/error.tsx y /auth/auth-error — un solo
 * lugar para la tarjeta de error amigable, así no se desalinean con el
 * tiempo. `children` es la acción (botón, link o form de cerrar sesión).
 * Cuando `entry.reportable`, agrega "Contarle al soporte" (Fase 7) —
 * `motivo` identifica el caso para el catálogo, `technicalDetail` solo
 * llega desde un error boundary real (mensaje/digest de la excepción).
 */
export function ErrorCard({
  entry,
  motivo,
  technicalDetail,
  children,
}: {
  entry: ErrorEntry;
  motivo: string;
  technicalDetail?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-6">
      <div className="border border-border bg-card p-11">
        <div className="mb-5 flex size-10 items-center justify-center rounded-full border border-destructive">
          <AlertTriangle className="size-5 text-destructive" aria-hidden />
        </div>
        <h1 className="font-serif text-[28px] leading-tight">{entry.titulo}</h1>
        <p className="mt-3.5 text-[15px] leading-relaxed text-foreground/85">{entry.mensaje}</p>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{entry.queHacer}</p>
        <div className="mt-7 flex flex-wrap gap-2.5">
          {children}
          {entry.reportable && (
            <ReportErrorDialog motivo={motivo} titulo={entry.titulo} technicalDetail={technicalDetail} />
          )}
        </div>
      </div>
    </div>
  );
}
