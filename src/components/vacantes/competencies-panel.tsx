"use client";

import { useActionState, useEffect } from "react";
import { addCompetency, deleteCompetency } from "@/lib/competencies/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DeleteButton } from "@/components/ui/delete-button";
import type { JobCompetency } from "@/lib/competencies/get-competencies";

export function CompetenciesPanel({ jobId, competencies }: { jobId: string; competencies: JobCompetency[] }) {
  const action = addCompetency.bind(null, jobId);
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) notifySuccess(state.success);
  }, [state]);

  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Competencias a evaluar</h2>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        La rúbrica que verán los evaluadores en cada postulación de esta vacante.
      </p>

      {competencies.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Todavía no hay competencias — agrega la primera abajo.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60 border border-border">
          {competencies.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm">{c.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-muted-foreground">Peso {c.weight}</span>
                <DeleteButton
                  itemLabel={`la competencia "${c.name}"`}
                  iconOnly
                  onDelete={() => deleteCompetency(c.id, jobId)}
                  successMessage="Competencia eliminada"
                  confirmDescription="Se perderán todas las calificaciones y comentarios ya registrados para esta competencia, en todas las postulaciones de esta vacante."
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2.5">
        <div className="flex flex-col gap-1">
          <label htmlFor="name" className="text-xs text-muted-foreground">
            Nombre
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="Comunicación"
            className="h-[38px] w-52 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="weight" className="text-xs text-muted-foreground">
            Peso (0-100)
          </label>
          <input
            id="weight"
            name="weight"
            type="number"
            min={0}
            max={100}
            defaultValue={0}
            className="h-[38px] w-24 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
          />
        </div>
        <ActionButton type="submit" variant="secondary" className="h-[38px]" pendingLabel="Agregando…">
          Agregar competencia
        </ActionButton>
      </form>
    </section>
  );
}
