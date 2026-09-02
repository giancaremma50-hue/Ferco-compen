"use client";

import { useState, useTransition } from "react";
import { updateInterviewStatus, deleteInterview } from "@/lib/interviews/actions";
import { buildInterviewCalendarUrl } from "@/lib/interviews/calendar-link";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DeleteButton } from "@/components/ui/delete-button";
import type { ApplicationInterview } from "@/lib/interviews/get-interviews";

const STATUS_LABEL: Record<ApplicationInterview["status"], string> = {
  programada: "Programada",
  completada: "Completada",
  cancelada: "Cancelada",
};

function InterviewRow({
  interview,
  applicationId,
  jobTitle,
}: {
  interview: ApplicationInterview;
  applicationId: string;
  jobTitle: string;
}) {
  const [pending, startTransition] = useTransition();
  // Cuál de los dos botones disparó la transición — sin esto, "Cancelar" y
  // "Marcar completada" comparten el mismo `pending` y ambos muestran el
  // spinner aunque solo uno esté realmente en vuelo.
  const [pendingStatus, setPendingStatus] = useState<"completada" | "cancelada" | null>(null);

  function handleStatus(status: "completada" | "cancelada") {
    setPendingStatus(status);
    startTransition(async () => {
      const result = await updateInterviewStatus(interview.id, applicationId, status);
      if (result.error) notifyError(result.error);
      else notifySuccess(result.success ?? "Actualizado");
    });
  }

  const calendarUrl = buildInterviewCalendarUrl(jobTitle, interview);

  return (
    <div className="border border-border bg-card p-3.5 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium tabular-nums">
            {new Date(interview.scheduledAt).toLocaleString("es", { dateStyle: "long", timeStyle: "short" })}
          </p>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {interview.interviewerName} · {interview.durationMinutes} min
            {interview.location && <> · {interview.location}</>}
          </p>
        </div>
        <span className="flex-none text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
          {STATUS_LABEL[interview.status]}
        </span>
      </div>

      {interview.notes && <p className="mt-2 text-xs text-muted-foreground">{interview.notes}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <a
          href={calendarUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 rounded-md border border-border px-3 text-xs leading-8"
        >
          Agregar a mi calendario
        </a>
        {interview.status === "programada" && (
          <>
            <ActionButton
              type="button"
              variant="secondary"
              className="h-8 px-3 text-xs"
              disabled={pending}
              pending={pending && pendingStatus === "completada"}
              onClick={() => handleStatus("completada")}
            >
              Marcar completada
            </ActionButton>
            <ActionButton
              type="button"
              variant="ghost"
              className="h-8 px-3 text-xs"
              disabled={pending}
              pending={pending && pendingStatus === "cancelada"}
              onClick={() => handleStatus("cancelada")}
            >
              Cancelar
            </ActionButton>
          </>
        )}
        <DeleteButton
          itemLabel="esta entrevista"
          iconOnly
          className="ml-auto"
          onDelete={() => deleteInterview(interview.id, applicationId)}
          successMessage="Entrevista eliminada"
        />
      </div>
    </div>
  );
}

export function InterviewList({
  interviews,
  applicationId,
  jobTitle,
}: {
  interviews: ApplicationInterview[];
  applicationId: string;
  jobTitle: string;
}) {
  if (interviews.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin entrevistas agendadas todavía.</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {interviews.map((i) => (
        <InterviewRow key={i.id} interview={i} applicationId={applicationId} jobTitle={jobTitle} />
      ))}
    </div>
  );
}
