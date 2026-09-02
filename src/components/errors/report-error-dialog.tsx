"use client";

import { useActionState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createErrorReport } from "@/lib/errors/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DialogShell, type DialogShellHandle } from "@/components/ui/dialog-shell";

/**
 * Única puerta de entrada a "Contarle al soporte" — una sola pregunta,
 * el resto del contexto técnico se adjunta solo (AGENTS.md, "Centro de
 * errores"). `technicalDetail` es opcional: solo llega cuando se invoca
 * desde un error boundary real (src/app/error.tsx), no desde una tarjeta
 * de error de negocio (permiso denegado, dominio no permitido, etc.).
 */
export function ReportErrorDialog({ motivo, titulo, technicalDetail }: { motivo: string; titulo: string; technicalDetail?: string }) {
  const dialogRef = useRef<DialogShellHandle>(null);
  const pathname = usePathname();
  const context = {
    motivo,
    titulo,
    url: typeof window !== "undefined" ? window.location.href : pathname,
    user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    technical_detail: technicalDetail,
  };
  const action = createErrorReport.bind(null, context);
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) {
      notifySuccess(state.success);
      dialogRef.current?.close();
    }
  }, [state]);

  return (
    <>
      <ActionButton type="button" variant="secondary" onClick={() => dialogRef.current?.open()}>
        Contarle al soporte
      </ActionButton>
      <DialogShell ref={dialogRef} title="¿Qué estabas intentando hacer?">
        <form action={formAction}>
          <p className="text-sm text-muted-foreground">
            Cuéntanos en tus palabras. Adjuntamos el resto (página, navegador) automáticamente.
          </p>
          <textarea
            name="user_message"
            required
            minLength={5}
            maxLength={2000}
            rows={4}
            className="mt-4 w-full resize-none rounded-md border border-border bg-background p-3 text-sm outline-none focus:border-foreground"
            placeholder="Estaba subiendo el CV de una candidata y…"
          />
          <div className="mt-5 flex justify-end gap-2.5">
            <ActionButton type="button" variant="ghost" onClick={() => dialogRef.current?.close()}>
              Cancelar
            </ActionButton>
            <ActionButton type="submit" pendingLabel="Enviando…">
              Enviar
            </ActionButton>
          </div>
        </form>
      </DialogShell>
    </>
  );
}
