import Link from "next/link";
import { dueDateLabel, isTaskOverdue } from "@/lib/org-today";
import type { AgendaData } from "@/lib/dashboard/get-agenda";

/**
 * Bloque protagonista de Inicio: es lo único que responde "qué tengo que
 * hacer ahora" (decisión del usuario, 2026-09-03 — antes iba tercera y con
 * el mismo peso visual que las cifras). Dos columnas: entrevistas con la hora
 * en serif grande, tareas con su fecha límite.
 */
export function TodayAgenda({ data }: { data: AgendaData }) {
  const overdueCount = data.tasks.filter((t) => t.dueDate && isTaskOverdue(t.dueDate)).length;
  const isEmpty = data.interviews.length === 0 && data.tasks.length === 0;

  return (
    <div className="border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-[22px]">Tu agenda de hoy</h2>
        {!isEmpty && (
          <div className="flex flex-wrap items-center gap-1.5">
            {data.interviews.length > 0 && (
              <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] text-white">
                {data.interviews.length} {data.interviews.length === 1 ? "entrevista" : "entrevistas"}
              </span>
            )}
            {data.tasks.length > 0 && (
              <span className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                {data.tasks.length} {data.tasks.length === 1 ? "tarea" : "tareas"}
              </span>
            )}
            {overdueCount > 0 && (
              <span className="rounded-full border border-destructive px-2.5 py-1 text-[11px] text-destructive">
                {overdueCount} {overdueCount === 1 ? "vencida" : "vencidas"}
              </span>
            )}
          </div>
        )}
      </div>

      {isEmpty ? (
        <p className="mt-3 text-sm text-muted-foreground">Sin entrevistas ni tareas pendientes por ahora.</p>
      ) : (
        <div className="mt-5 grid gap-6 sm:grid-cols-2 sm:gap-8 sm:divide-x sm:divide-border/60">
          <div>
            <p className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Entrevistas</p>
            {data.interviews.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Sin entrevistas hoy.</p>
            ) : (
              <div className="mt-1.5 divide-y divide-border/60">
                {data.interviews.map((i) => (
                  <Link
                    key={i.id}
                    href={`/postulaciones/${i.applicationId}`}
                    className="flex items-center gap-3 py-2.5 text-sm hover:bg-muted/30"
                  >
                    <span className="font-serif w-14 flex-none text-[19px] tabular-nums">
                      {new Date(i.scheduledAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{i.candidateName}</span>
                    <span className="hidden flex-none text-xs text-muted-foreground sm:inline">{i.jobTitle}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="sm:pl-8">
            <p className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Tareas pendientes</p>
            {data.tasks.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Sin tareas pendientes.</p>
            ) : (
              <div className="mt-1.5 divide-y divide-border/60">
                {data.tasks.map((t) => {
                  const due = t.dueDate ? dueDateLabel(t.dueDate) : null;
                  return (
                    <Link
                      key={t.id}
                      href={`/postulaciones/${t.applicationId}`}
                      className="flex items-center gap-3 py-2.5 text-sm hover:bg-muted/30"
                    >
                      <span className="min-w-0 flex-1 truncate">{t.description}</span>
                      <span className="flex-none text-xs text-muted-foreground">
                        {due ? (
                          <span className={due.overdue ? "text-destructive" : undefined}>{due.text}</span>
                        ) : (
                          t.candidateName
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
