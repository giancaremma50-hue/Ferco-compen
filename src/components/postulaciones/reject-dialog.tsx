"use client";

import { useActionState, useEffect, useRef } from "react";
import { rejectApplication } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DialogShell, type DialogShellHandle } from "@/components/ui/dialog-shell";

type RejectionReason = { id: string; label: string };

export function RejectDialog({ applicationId, reasons }: { applicationId: string; reasons: RejectionReason[] }) {
  const dialogRef = useRef<DialogShellHandle>(null);
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
        onClick={() => dialogRef.current?.open()}
      >
        Rechazar
      </ActionButton>
      <DialogShell ref={dialogRef} title="¿Rechazar esta postulación?">
        <form action={formAction} className="flex flex-col gap-4">
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
      </DialogShell>
    </>
  );
}
