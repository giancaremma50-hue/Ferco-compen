"use client";

import { useActionState, useEffect, useState } from "react";
import { X } from "lucide-react";
import { scheduleInterview } from "@/lib/interviews/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import type { AssignableProfile } from "@/lib/applications/get-applications";

const STEP_LABELS = ["Fecha", "Hora", "Destinatarios"];

/**
 * Sub-drawer de 3 pasos sobre el drawer de candidato — mismo
 * scheduleInterview() que ya usa InterviewForm (la versión plana en
 * /postulaciones/[id]), solo con la interacción partida en pasos en vez de
 * un formulario largo de una vez.
 */
export function MeetingScheduler({
  applicationId,
  candidateName,
  candidateEmail,
  assignable,
  onClose,
  onScheduled,
}: {
  applicationId: string;
  candidateName: string;
  candidateEmail: string;
  assignable: AssignableProfile[];
  onClose: () => void;
  onScheduled: () => void;
}) {
  const [step, setStep] = useState(0);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("10:00");
  const [attendeeIds, setAttendeeIds] = useState<string[]>([]);
  const [duration, setDuration] = useState(30);
  const [location, setLocation] = useState("");
  const [search, setSearch] = useState("");

  const boundAction = scheduleInterview.bind(null, applicationId);
  async function action(prevState: Awaited<ReturnType<typeof boundAction>> | undefined, formData: FormData) {
    formData.set("scheduled_at", new Date(`${date}T${time}`).toISOString());
    formData.set("attendee_ids", JSON.stringify(attendeeIds));
    formData.set("duration_minutes", String(duration));
    formData.set("location", location);
    return boundAction(prevState, formData);
  }
  const [state, formAction, pending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) {
      notifySuccess(state.success);
      onScheduled();
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  function addAttendee(id: string) {
    setAttendeeIds((prev) => [...prev, id]);
    setSearch("");
  }
  function removeAttendee(id: string) {
    setAttendeeIds((prev) => prev.filter((a) => a !== id));
  }

  const selectedAttendees = assignable.filter((p) => attendeeIds.includes(p.id));
  const searchResults = assignable.filter(
    (p) => !attendeeIds.includes(p.id) && p.display_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-y-0 right-0 z-[60] flex w-full max-w-[420px] flex-col border-l border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-serif text-xl">Agendar reunión</h3>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="flex size-[30px] flex-none items-center justify-center rounded-md border border-border"
        >
          <X className="size-3.5 text-muted-foreground" aria-hidden />
        </button>
      </div>

      <div className="mt-3.5 flex gap-1.5">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className={`h-[3px] flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-border"}`} />
        ))}
      </div>

      <form action={formAction} className="mt-6 flex flex-1 flex-col">
        {step === 0 && (
          <div className="flex flex-1 flex-col gap-2">
            <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Paso 1 de 3 — Fecha</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 rounded-md border border-border bg-background px-3 text-sm"
            />
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Paso 2 de 3 — Hora</span>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-11 rounded-md border border-border bg-background px-3 text-sm"
              />
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Duración (min)</span>
              <input
                type="number"
                min={15}
                max={480}
                step={15}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="h-9 w-24 rounded-md border border-border bg-background px-2.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Lugar o enlace (opcional)</span>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={200}
                placeholder="Google Meet, oficina, etc."
                className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col gap-3">
            <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Paso 3 de 3 — Destinatarios</span>
            <p className="text-xs text-muted-foreground">Cada uno recibe su propio enlace para agregarlo a su calendario.</p>

            <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                <strong>{candidateName}</strong> <span className="text-xs text-muted-foreground">{candidateEmail}</span>
              </span>
              <span className="flex-none text-[10px] tracking-[0.06em] text-muted-foreground uppercase">Candidato · automático</span>
            </div>

            {selectedAttendees.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedAttendees.map((p) => (
                  <span key={p.id} className="flex items-center gap-1.5 rounded-full border border-border py-1 pl-2.5 pr-1.5 text-xs">
                    {p.display_name}
                    <button
                      type="button"
                      aria-label={`Quitar a ${p.display_name}`}
                      onClick={() => removeAttendee(p.id)}
                      className="flex size-4 items-center justify-center rounded-full hover:bg-muted"
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              // Enter en este campo no debe enviar el formulario — el botón
              // "Confirmar" queda habilitado en cuanto hay 1 destinatario, y
              // sin esto, Enter mientras se busca a un segundo colega agenda
              // la reunión de una vez (con menos destinatarios de los que el
              // usuario todavía quería agregar), sin pasar por "Confirmar".
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              placeholder="Buscar colega por nombre…"
              className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
            />
            {assignable.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nadie más tiene acceso a esta vacante todavía.</p>
            ) : (
              <div className="flex flex-col gap-0.5 overflow-y-auto" style={{ maxHeight: 160 }}>
                {searchResults.length === 0 && <p className="px-1 text-xs text-muted-foreground">Sin resultados.</p>}
                {searchResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addAttendee(p.id)}
                    className="rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted/60"
                  >
                    {p.display_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-auto flex justify-between pt-5">
          {step > 0 ? (
            <ActionButton type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
              Atrás
            </ActionButton>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <ActionButton type="button" disabled={step === 0 && !date} onClick={() => setStep((s) => s + 1)}>
              Siguiente
            </ActionButton>
          ) : (
            <ActionButton type="submit" pending={pending} pendingLabel="Agendando…" disabled={attendeeIds.length === 0}>
              Confirmar
            </ActionButton>
          )}
        </div>
      </form>
    </div>
  );
}
