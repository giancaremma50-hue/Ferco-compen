"use client";

import { useActionState, useEffect, useRef } from "react";
import { scheduleInterview } from "@/lib/interviews/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import type { AssignableProfile } from "@/lib/applications/get-applications";

export function InterviewForm({ applicationId, assignable }: { applicationId: string; assignable: AssignableProfile[] }) {
  const boundAction = scheduleInterview.bind(null, applicationId);
  // El input visible es hora local del navegador — el servidor no puede
  // asumir su propia zona horaria, así que se convierte a ISO con offset
  // (toISOString) justo antes de invocar la Server Action.
  async function action(prevState: Awaited<ReturnType<typeof boundAction>> | undefined, formData: FormData) {
    const local = formData.get("scheduled_at");
    if (typeof local === "string" && local) formData.set("scheduled_at", new Date(local).toISOString());
    return boundAction(prevState, formData);
  }
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
      <div className="flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Fecha y hora</span>
          <input
            name="scheduled_at"
            type="datetime-local"
            required
            className="h-9 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Duración (min)</span>
          <input
            name="duration_minutes"
            type="number"
            min={15}
            max={480}
            step={15}
            defaultValue={30}
            className="h-9 w-24 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Entrevistador</span>
          <select
            name="interviewer_id"
            required
            defaultValue=""
            className="h-9 w-40 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="" disabled>
              Elegir…
            </option>
            {assignable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-muted-foreground">Lugar o enlace (opcional)</span>
          <input
            name="location"
            maxLength={200}
            placeholder="Google Meet, oficina, etc."
            className="h-9 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
          />
        </label>
      </div>
      <div className="flex items-end gap-2.5">
        <textarea
          name="notes"
          rows={2}
          maxLength={1000}
          placeholder="Notas para el entrevistador (opcional)…"
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        <ActionButton className="h-9 px-4 text-xs" pendingLabel="Agendando…">
          Agendar
        </ActionButton>
      </div>
    </form>
  );
}
