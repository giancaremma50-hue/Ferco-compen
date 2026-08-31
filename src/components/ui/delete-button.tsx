"use client";

import { useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { ConfirmDialog, type ConfirmDialogHandle } from "./confirm-dialog";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { cn } from "@/lib/utils";

/**
 * Todo botón de eliminar es rojo, usa el ícono X, y confirma antes de
 * actuar — regla no negociable. Nunca elimina en un solo clic.
 */
export function DeleteButton({
  itemLabel,
  onDelete,
  successMessage = "Se eliminó correctamente",
  confirmDescription,
  iconOnly = false,
  className,
}: {
  itemLabel: string;
  onDelete: () => Promise<void> | void;
  successMessage?: string;
  confirmDescription?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const dialogRef = useRef<ConfirmDialogHandle>(null);
  const [pending, startTransition] = useTransition();
  const [errored, setErrored] = useState(false);

  function handleConfirm() {
    startTransition(async () => {
      try {
        await onDelete();
        notifySuccess(successMessage);
        dialogRef.current?.close();
      } catch {
        setErrored(true);
        notifyError(
          "No se pudo eliminar",
          "Algo se rompió de nuestro lado. Puedes intentarlo de nuevo.",
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setErrored(false);
          dialogRef.current?.open();
        }}
        aria-label={iconOnly ? `Eliminar ${itemLabel}` : undefined}
        className={cn(
          iconOnly
            ? "flex size-8 items-center justify-center rounded-md border border-destructive text-destructive"
            : "inline-flex h-[38px] items-center gap-2 rounded-md border border-destructive bg-card px-4 text-sm font-medium text-destructive",
          className,
        )}
      >
        <X className="size-3.5" aria-hidden />
        {!iconOnly && <span>Eliminar</span>}
      </button>
      <ConfirmDialog
        ref={dialogRef}
        tone="destructive"
        title={`¿Eliminar ${itemLabel}?`}
        description={`${confirmDescription ?? "Esto no se puede deshacer."}${errored ? " El intento anterior falló — puedes volver a intentarlo." : ""}`}
        confirmLabel="Sí, eliminar"
        onConfirm={handleConfirm}
        pending={pending}
      />
    </>
  );
}
