"use client";

import { useActionState, useEffect } from "react";
import { addJobCollaborator, removeJobCollaborator } from "@/lib/jobs/collaborators-actions";
import { PERMISSION_LABEL } from "@/lib/jobs/collaborators-schema";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DeleteButton } from "@/components/ui/delete-button";
import type { JobCollaboratorRow } from "@/lib/jobs/get-collaborators";
import type { AddableProfile } from "@/lib/jobs/get-collaborators";

export function CollaboratorsPanel({
  jobId,
  collaborators,
  addable,
}: {
  jobId: string;
  collaborators: JobCollaboratorRow[];
  addable: AddableProfile[];
}) {
  const action = addJobCollaborator.bind(null, jobId);
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) notifySuccess(state.success);
  }, [state]);

  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Colaboradores de esta vacante</h2>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Acceso fino por persona, sin subir su rol global — ver AGENTS.md.
      </p>

      {collaborators.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Todavía no hay colaboradores agregados. Agrega uno con el formulario de abajo.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60 border border-border">
          {collaborators.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{c.profile?.display_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{c.profile?.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{PERMISSION_LABEL[c.permission]}</span>
                <DeleteButton
                  itemLabel={`a ${c.profile?.display_name ?? "esta persona"} como colaborador`}
                  iconOnly
                  onDelete={() => removeJobCollaborator(c.id, jobId)}
                  successMessage="Colaborador eliminado"
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {addable.length > 0 && (
        <form action={formAction} className="mt-4 flex flex-wrap items-end gap-2.5">
          <div className="flex flex-col gap-1">
            <label htmlFor="profile_id" className="text-xs text-muted-foreground">
              Persona
            </label>
            <select
              id="profile_id"
              name="profile_id"
              required
              defaultValue=""
              className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm"
            >
              <option value="" disabled>
                Elige…
              </option>
              {addable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="permission" className="text-xs text-muted-foreground">
              Nivel de acceso
            </label>
            <select
              id="permission"
              name="permission"
              required
              defaultValue="viewer"
              className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm"
            >
              {Object.entries(PERMISSION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <ActionButton type="submit" variant="secondary" className="h-[38px]" pendingLabel="Agregando…">
            Agregar colaborador
          </ActionButton>
        </form>
      )}
    </section>
  );
}
