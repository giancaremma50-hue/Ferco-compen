"use client";

import { useActionState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { rejectApplication } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";

type RejectionReason = { id: string; label: string };

export function RejectDialog({ applicationId, reasons }: { applicationId: string; reasons: RejectionReason[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const action = rejectApplication.bind(null, applicationId);
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
        variant="ghost"
        className="text-destructive"
        onClick={() => dialogRef.current?.showModal()}
      >
        Rechazar
      </ActionButton>
      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="w-full max-w-[440px] rounded-lg border border-border bg-card p-0 text-foreground backdrop:bg-foreground/25"
      >
        <div className="p-7">
          <div className="flex items-start justify-between gap-5">
            <h2 className="font-serif text-[23px] leading-tight">¿Rechazar esta postulación?</h2>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => dialogRef.current?.close()}
              className="flex size-[30px] flex-none items-center justify-center rounded-md border border-border bg-card"
            >
              <X className="size-3.5 text-muted-foreground" aria-hidden />
            </button>
          </div>
          <form action={formAction} className="mt-5 flex flex-col gap-4">
            <select
              name="rejection_reason_id"
              required
              defaultValue=""
              aria-invalid={state?.field === "rejection_reason_id"}
              className={`h-11 rounded-md border bg-background px-3 text-sm ${state?.field === "rejection_reason_id" ? "border-destructive" : "border-border"}`}
            >
              <option value="" disabled>
                Elige un motivo
              </option>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            {state?.field === "rejection_reason_id" && <p className="text-xs text-destructive">{state.error}</p>}
            <ActionButton variant="destructive">Sí, rechazar</ActionButton>
          </form>
        </div>
      </dialog>
    </>
  );
}
