"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addJobCollaborator, removeJobCollaborator, reassignRecruiter } from "@/lib/jobs/collaborators-actions";
import { PERMISSION_LABEL, PERMISSION_HINT, MEMBER_PERMISSIONS, type MemberPermission } from "@/lib/jobs/collaborators-schema";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DeleteButton } from "@/components/ui/delete-button";
import { DialogShell, type DialogShellHandle } from "@/components/ui/dialog-shell";
import type { JobCollaboratorRow, AddableProfile } from "@/lib/jobs/get-collaborators";
import type { TeamMemberOption } from "@/lib/jobs/get-team-options";

/** Insignia derivada, no guardada: se compara el perfil contra owner_id/requested_by de la vacante. */
function roleBadge(profileId: string, ownerId: string | null, requesterId: string | null): string | null {
  if (profileId === ownerId) return "Reclutador asignado";
  if (profileId === requesterId) return "Solicitante";
  return null;
}

export function CollaboratorsPanel({
  jobId,
  collaborators,
  addable,
  admins,
  ownerId,
  requesterId,
}: {
  jobId: string;
  collaborators: JobCollaboratorRow[];
  addable: AddableProfile[];
  /** Para el selector de reasignación — el reclutador asignado siempre es admin+. */
  admins: TeamMemberOption[];
  ownerId: string | null;
  requesterId: string | null;
}) {
  const action = addJobCollaborator.bind(null, jobId);
  const [state, formAction] = useActionState(action, undefined);
  // El más bajo por defecto — mismo principio que la visibilidad al publicar: ningún valor privilegiado silencioso.
  const [permission, setPermission] = useState<MemberPermission>("solo_lectura");
  const reassignRef = useRef<DialogShellHandle>(null);
  const [newOwnerId, setNewOwnerId] = useState("");
  const [reassignState, reassignAction] = useActionState(reassignRecruiter.bind(null, jobId), undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) notifySuccess(state.success);
  }, [state]);

  useEffect(() => {
    if (reassignState?.error) notifyError(reassignState.error);
    else if (reassignState?.success) {
      notifySuccess(reassignState.success);
      reassignRef.current?.close();
    }
  }, [reassignState]);

  return (
    <section className="mt-8 border-t border-border pt-6">
      <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Miembros de esta vacante</h2>
      <p className="mt-1.5 text-[13px] text-muted-foreground">
        Quien está acá ve la vacante, sus candidatos y cómo va el avance. Mover etapas y decidir sobre un candidato queda
        solo en manos del reclutador asignado y de RH.
      </p>

      {collaborators.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Todavía no hay miembros agregados. Agrega uno con el formulario de abajo.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border/60 border border-border">
          {collaborators.map((c) => {
            const badge = roleBadge(c.profile_id, ownerId, requesterId);
            const isRecruiter = c.profile_id === ownerId;
            return (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {c.profile?.display_name ?? "—"}
                    {badge && (
                      <span className="ml-2 rounded-full border border-accent px-2 py-0.5 text-[10px] tracking-[0.04em] text-accent uppercase">
                        {badge}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.profile?.email}</p>
                </div>
                <div className="flex flex-none items-center gap-3">
                  <span className="text-xs text-muted-foreground">{PERMISSION_LABEL[c.permission]}</span>
                  {/* Quitar al reclutador asignado no lo borra sin más: abre la
                      reasignación, o la vacante quedaría sin nadie que pueda
                      mover etapas salvo RH. */}
                  {isRecruiter ? (
                    <ActionButton
                      type="button"
                      variant="secondary"
                      className="h-8 px-3 text-xs"
                      onClick={() => reassignRef.current?.open()}
                    >
                      Reasignar
                    </ActionButton>
                  ) : (
                    <DeleteButton
                      itemLabel={`a ${c.profile?.display_name ?? "esta persona"} de esta vacante`}
                      iconOnly
                      onDelete={() => removeJobCollaborator(c.id, jobId)}
                      successMessage="Miembro eliminado"
                    />
                  )}
                </div>
              </li>
            );
          })}
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
              value={permission}
              onChange={(e) => setPermission(e.target.value as MemberPermission)}
              className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm"
            >
              {MEMBER_PERMISSIONS.map((value) => (
                <option key={value} value={value}>
                  {PERMISSION_LABEL[value]}
                </option>
              ))}
            </select>
          </div>
          <ActionButton type="submit" variant="secondary" className="h-[38px]" pendingLabel="Agregando…">
            Agregar miembro
          </ActionButton>
          <p className="w-full text-xs text-muted-foreground">{PERMISSION_HINT[permission]}</p>
        </form>
      )}

      <DialogShell ref={reassignRef} title="Reasignar el reclutador de esta vacante">
        <form action={reassignAction} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            La vacante no puede quedar sin reclutador asignado: elige quién la lleva de ahora en adelante.
          </p>
          <select
            name="owner_id"
            required
            value={newOwnerId}
            onChange={(e) => setNewOwnerId(e.target.value)}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Elige a quién la pasa…
            </option>
            {admins
              .filter((a) => a.id !== ownerId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name}
                </option>
              ))}
          </select>
          <ActionButton pendingLabel="Reasignando…" disabled={!newOwnerId}>
            Reasignar
          </ActionButton>
        </form>
      </DialogShell>
    </section>
  );
}
