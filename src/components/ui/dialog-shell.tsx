"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type DialogShellHandle = { open: () => void; close: () => void };

/**
 * Chrome de diálogo compartido: el mismo <dialog> + cierre al hacer clic
 * fuera + botón X que antes vivía copiado en report-error-dialog.tsx,
 * reject-dialog.tsx y department-dialog.tsx (misma clase que ConfirmDialog,
 * el único que ya era compartido). El contenido (formulario, campos) lo
 * pone cada caller como children.
 */
export const DialogShell = forwardRef<
  DialogShellHandle,
  { title: string; maxWidthClassName?: string; children: React.ReactNode }
>(function DialogShell({ title, maxWidthClassName = "max-w-[440px]", children }, ref) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => dialogRef.current?.showModal(),
    close: () => dialogRef.current?.close(),
  }));

  return (
    <dialog
      ref={dialogRef}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
      className={cn(
        "w-full rounded-lg border border-border bg-card p-0 text-foreground backdrop:bg-foreground/25",
        maxWidthClassName,
      )}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-5">
          <h2 className="font-serif text-[22px] leading-tight">{title}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => dialogRef.current?.close()}
            className="flex size-[30px] flex-none items-center justify-center rounded-md border border-border bg-card"
          >
            <X className="size-3.5 text-muted-foreground" aria-hidden />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
});
