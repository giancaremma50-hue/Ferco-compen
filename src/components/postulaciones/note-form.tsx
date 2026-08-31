"use client";

import { useActionState, useEffect, useRef } from "react";
import { addNote } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";

export function NoteForm({ applicationId }: { applicationId: string }) {
  const action = addNote.bind(null, applicationId);
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) {
      notifySuccess(state.success);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2.5">
      <textarea
        name="body"
        required
        rows={3}
        placeholder="Escribe una nota sobre este candidato…"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input name="is_private" type="checkbox" className="size-3.5" />
          Solo visible para admin+
        </label>
        <ActionButton className="h-9 px-4 text-xs">Agregar nota</ActionButton>
      </div>
    </form>
  );
}
