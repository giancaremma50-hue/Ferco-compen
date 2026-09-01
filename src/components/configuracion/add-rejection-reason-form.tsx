"use client";

import { useActionState, useEffect, useRef } from "react";
import { createRejectionReason } from "@/lib/rejection-reasons/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";

export function AddRejectionReasonForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(createRejectionReason, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) {
      notifySuccess(state.success);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-2.5">
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-muted-foreground">Nuevo motivo</span>
        <input
          name="label"
          required
          minLength={2}
          maxLength={160}
          placeholder="No cumple con la experiencia requerida"
          className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
        />
      </label>
      <ActionButton type="submit" variant="secondary" className="h-[38px]" pendingLabel="Agregando…">
        Agregar
      </ActionButton>
    </form>
  );
}
