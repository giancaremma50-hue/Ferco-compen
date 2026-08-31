"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { referCandidate } from "@/lib/jobs/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";

export function ReferCandidateDialog({ jobId }: { jobId: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const action = referCandidate.bind(null, jobId);
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
      <ActionButton
        type="button"
        variant="secondary"
        onClick={() => {
          setOpen(true);
          dialogRef.current?.showModal();
        }}
      >
        Referir candidato
      </ActionButton>
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
            <h2 className="font-serif text-[23px] leading-tight">Referir candidato</h2>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => dialogRef.current?.close()}
              className="flex size-[30px] flex-none items-center justify-center rounded-md border border-border bg-card"
            >
              <X className="size-3.5 text-muted-foreground" aria-hidden />
            </button>
          </div>

          {open && (
            <form action={formAction} className="mt-5 flex flex-col gap-4">
              <input
                name="full_name"
                required
                placeholder="Nombre completo"
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
              />
              <input
                name="email"
                type="email"
                required
                placeholder="Correo"
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
              />
              <input
                name="phone"
                required
                placeholder="Teléfono"
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
              />
              <ActionButton>Referir</ActionButton>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
