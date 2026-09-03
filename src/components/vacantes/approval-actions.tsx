"use client";

import { useRef, useState, useTransition } from "react";
import {
  submitForApproval,
  acceptJobRequest,
  returnJobRequest,
  publishJob,
  pauseJob,
  reopenJob,
  closeJob,
  cancelJob,
  type JobActionResult,
} from "@/lib/jobs/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { ConfirmDialog, type ConfirmDialogHandle } from "@/components/ui/confirm-dialog";
import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import { TERMINAL_JOB_STATUSES } from "@/lib/jobs/permissions";
import { VISIBILITY_LABEL, type JobVisibility } from "@/lib/jobs/schema";
import type { JobDetail } from "@/lib/jobs/get-jobs";
import type { TeamMemberOption } from "@/lib/jobs/get-team-options";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

export function ApprovalActions({
  job,
  role,
  actorId,
  admins,
}: {
  job: JobDetail;
  role: AppRole;
  actorId: string;
  admins: TeamMemberOption[];
}) {
  const [pending, startTransition] = useTransition();
  const closeDialogRef = useRef<ConfirmDialogHandle>(null);
  const cancelDialogRef = useRef<ConfirmDialogHandle>(null);
  const [ownerId, setOwnerId] = useState(() => (admins.some((a) => a.id === actorId) ? actorId : (admins[0]?.id ?? "")));
  const [visibility, setVisibility] = useState<JobVisibility>("confidencial");

  const isAdmin = ADMIN_ROLES.has(role);
  const isOwner = job.requested_by === actorId;

  function run(action: () => Promise<JobActionResult>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.error) notifyError(result.error);
      else {
        notifySuccess(result.success ?? "Vacante actualizada");
        onSuccess?.();
      }
    });
  }

  if (TERMINAL_JOB_STATUSES.has(job.status)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {job.status === "borrador" && (
        <>
          {(isOwner || isAdmin) && (
            <ActionButton
              type="button"
              variant="secondary"
              pending={pending}
              pendingLabel="Enviando…"
              onClick={() => run(() => submitForApproval(job.id))}
            >
              Enviar a aprobación
            </ActionButton>
          )}
          {(isOwner || isAdmin) && (
            <ActionButton
              type="button"
              variant="ghost"
              className="text-destructive"
              onClick={() => cancelDialogRef.current?.open()}
            >
              Cancelar
            </ActionButton>
          )}
        </>
      )}

      {job.status === "pendiente_aprobacion" && (
        <>
          {isAdmin ? (
            <>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Encargado
                <select
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                >
                  {admins.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <ActionButton
                type="button"
                pending={pending}
                pendingLabel="Aceptando…"
                disabled={!ownerId}
                onClick={() => run(() => acceptJobRequest(job.id, ownerId))}
              >
                Aceptar
              </ActionButton>
              <ActionButton
                type="button"
                variant="secondary"
                pending={pending}
                pendingLabel="Devolviendo…"
                onClick={() => run(() => returnJobRequest(job.id))}
              >
                Devolver al solicitante
              </ActionButton>
              <ActionButton
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => cancelDialogRef.current?.open()}
              >
                Cancelar
              </ActionButton>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Esperando aprobación de RH.</p>
          )}
        </>
      )}

      {job.status === "aceptada" && (
        <>
          {isAdmin ? (
            <>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Visibilidad
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as JobVisibility)}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                >
                  {Object.entries(VISIBILITY_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <ActionButton
                type="button"
                pending={pending}
                pendingLabel="Publicando…"
                onClick={() => run(() => publishJob(job.id, visibility))}
              >
                Publicar
              </ActionButton>
              <ActionButton
                type="button"
                variant="ghost"
                className="text-destructive"
                onClick={() => cancelDialogRef.current?.open()}
              >
                Cancelar
              </ActionButton>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Aceptada — RH la está preparando para publicarse.</p>
          )}
        </>
      )}

      {job.status === "abierta" && isAdmin && (
        <>
          <ActionButton
            type="button"
            variant="secondary"
            pending={pending}
            pendingLabel="Pausando…"
            onClick={() => run(() => pauseJob(job.id))}
          >
            Pausar
          </ActionButton>
          <ActionButton type="button" variant="ghost" className="text-destructive" onClick={() => closeDialogRef.current?.open()}>
            Cerrar vacante
          </ActionButton>
        </>
      )}

      {job.status === "pausada" && isAdmin && (
        <>
          <ActionButton
            type="button"
            pending={pending}
            pendingLabel="Reabriendo…"
            onClick={() => run(() => reopenJob(job.id))}
          >
            Reabrir
          </ActionButton>
          <ActionButton type="button" variant="ghost" className="text-destructive" onClick={() => closeDialogRef.current?.open()}>
            Cerrar vacante
          </ActionButton>
        </>
      )}

      <ConfirmDialog
        ref={cancelDialogRef}
        tone="destructive"
        title="¿Cancelar esta vacante?"
        description="Se marcará como cancelada. Puedes crear una nueva más adelante si vuelve a abrirse la necesidad."
        confirmLabel="Sí, cancelar"
        pending={pending}
        onConfirm={() => run(() => cancelJob(job.id), () => cancelDialogRef.current?.close())}
      />
      <ConfirmDialog
        ref={closeDialogRef}
        tone="destructive"
        title="¿Cerrar esta vacante?"
        description="Se marcará como cerrada y ya no aparecerá en el portal público. No se puede reabrir — si necesitas seguir recibiendo candidatos, pausa en vez de cerrar."
        confirmLabel="Sí, cerrar"
        pending={pending}
        onConfirm={() => run(() => closeJob(job.id), () => closeDialogRef.current?.close())}
      />
    </div>
  );
}
