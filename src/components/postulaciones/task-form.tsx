"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTask } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import type { AssignableProfile } from "@/lib/applications/get-applications";

export function TaskForm({ applicationId, assignable }: { applicationId: string; assignable: AssignableProfile[] }) {
  const action = addTask.bind(null, applicationId);
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
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <input
        name="description"
        required
        minLength={3}
        maxLength={300}
        placeholder="Agendar segunda entrevista…"
        className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
      />
      <input
        name="due_date"
        type="date"
        aria-label="Fecha límite (opcional)"
        className="h-9 rounded-md border border-border bg-background px-2 text-xs"
      />
      <select
        name="assigned_to"
        defaultValue=""
        className="h-9 w-40 rounded-md border border-border bg-background px-2 text-xs"
      >
        <option value="">Sin asignar</option>
        {assignable.map((p) => (
          <option key={p.id} value={p.id}>
            {p.display_name}
          </option>
        ))}
      </select>
      <ActionButton className="h-9 px-4 text-xs" pendingLabel="Agregando…">
        Agregar
      </ActionButton>
    </form>
  );
}
