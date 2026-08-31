"use client";

import { useImperativeHandle, useRef, forwardRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActionButton } from "./action-button";

export type ConfirmDialogHandle = {
  open: () => void;
  close: () => void;
};

/**
 * Diálogo de confirmación sobre <dialog> nativo: accesible, sin dependencia
 * extra, foco atrapado y cierre con Escape por el propio navegador.
 */
export const ConfirmDialog = forwardRef<
  ConfirmDialogHandle,
  {
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: "destructive" | "default";
    onConfirm: () => void;
    pending?: boolean;
  }
>(function ConfirmDialog(
  { title, description, confirmLabel = "Confirmar", cancelLabel = "Cancelar", tone = "default", onConfirm, pending },
  ref,
) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => dialogRef.current?.showModal(),
    close: () => dialogRef.current?.close(),
  }));

  // El cierre en éxito lo decide quien llama a onConfirm (ver DeleteButton):
  // en error, el diálogo debe quedarse abierto para poder reintentar.

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "w-full max-w-[440px] rounded-lg border border-border bg-card p-0 text-foreground",
        "backdrop:bg-foreground/25",
      )}
      onClick={(e) => {
        if (e.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <div className="p-7">
        <div className="flex items-start justify-between gap-5">
          <h2 className="font-serif text-[23px] leading-tight">{title}</h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => dialogRef.current?.close()}
            className="flex size-[30px] flex-none items-center justify-center rounded-md border border-border bg-card"
          >
            <X className="size-3.5 text-muted-foreground" aria-hidden />
          </button>
        </div>
        <p className="mt-3.5 text-sm leading-relaxed text-foreground/85">{description}</p>
        <div className="mt-6 flex gap-2.5">
          <ActionButton
            type="button"
            variant={tone === "destructive" ? "destructive" : "primary"}
            pending={pending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </ActionButton>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="h-[42px] rounded-md border border-border bg-card px-5 text-sm text-foreground"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
});
