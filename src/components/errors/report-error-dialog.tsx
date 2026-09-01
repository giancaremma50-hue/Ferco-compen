"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { createErrorReport } from "@/lib/errors/report-actions";
import { ActionButton } from "@/components/ui/action-button";

/**
 * Una sola pregunta visible ("¿Qué estabas intentando hacer?"); el contexto
 * técnico se adjunta solo, en inputs ocultos, calculado en el momento del
 * render (esta rama solo se monta client-side, después de abrir el diálogo
 * — nunca en el paso de SSR, así que `navigator`/`window` son seguros aquí).
 */
export function ReportErrorDialog({
  title,
  code,
  error,
}: {
  title: string;
  code: string;
  error?: (Error & { digest?: string }) | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
        className="inline-flex h-[42px] items-center justify-center rounded-md border border-border bg-card px-5 text-sm font-medium text-foreground"
      >
        Contarle al soporte
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="w-full max-w-[440px] rounded-lg border border-border bg-card p-0 text-foreground backdrop:bg-foreground/25"
      >
        <div className="p-7">
          <div className="flex items-start justify-between gap-5">
            <h2 className="font-serif text-[23px] leading-tight">Contarle al soporte</h2>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => dialogRef.current?.close()}
              className="flex size-[30px] flex-none items-center justify-center rounded-md border border-border bg-card"
            >
              <X className="size-3.5 text-muted-foreground" aria-hidden />
            </button>
          </div>

          {/* Montado solo mientras open — así useActionState arranca de
              cero cada vez que se reabre, en vez de arrastrar el estado
              "success" de un envío anterior en la misma visita a la página. */}
          {open && (
            <ReportForm title={title} code={code} error={error} onClose={() => dialogRef.current?.close()} />
          )}
        </div>
      </dialog>
    </>
  );
}

function ReportForm({
  title,
  code,
  error,
  onClose,
}: {
  title: string;
  code: string;
  error?: (Error & { digest?: string }) | null;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(createErrorReport, undefined);

  if (state?.success) {
    return (
      <div className="mt-5">
        <p className="text-sm leading-relaxed text-foreground/85">
          Reporte enviado — código <span className="font-medium tabular-nums">{state.code}</span>. Te avisamos
          apenas tengamos una respuesta.
        </p>
        <Link href="/mis-reportes" className="mt-4 inline-block text-sm text-accent underline" onClick={onClose}>
          Ver mis reportes
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-5 flex flex-col gap-4">
      <input type="hidden" name="title" value={title} />
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="url" value={window.location.href} />
      <input type="hidden" name="user_agent" value={navigator.userAgent} />
      {error?.message && <input type="hidden" name="technical_detail" value={error.message} />}
      {error?.digest && <input type="hidden" name="stack" value={`digest: ${error.digest}`} />}
      <textarea
        name="user_message"
        required
        rows={3}
        placeholder="¿Qué estabas intentando hacer?"
        className="rounded-md border border-border bg-background p-3 text-sm"
      />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <ActionButton>Enviar</ActionButton>
    </form>
  );
}
