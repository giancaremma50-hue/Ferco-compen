"use client";

import { useActionState, useEffect, useRef } from "react";
import { createSegment } from "@/lib/candidates/segments-actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DialogShell, type DialogShellHandle } from "@/components/ui/dialog-shell";
import type { CandidateFilters } from "@/lib/candidates/get-candidates";

export function SaveSegmentButton({ filters }: { filters: CandidateFilters }) {
  const dialogRef = useRef<DialogShellHandle>(null);
  const [state, formAction] = useActionState(createSegment, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) {
      notifySuccess(state.success);
      dialogRef.current?.close();
    }
  }, [state]);

  const activeFilters = Object.entries(filters).filter((entry): entry is [string, string] => Boolean(entry[1]));
  if (activeFilters.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.open()}
        className="h-9 rounded-md border border-border px-3 text-xs text-muted-foreground"
      >
        Guardar como segmento
      </button>
      <DialogShell ref={dialogRef} title="Guardar segmento" maxWidthClassName="max-w-[380px]">
        <form action={formAction}>
          {activeFilters.map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}

          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Nombre</span>
            <input
              name="name"
              required
              autoFocus
              maxLength={80}
              placeholder="Candidatos en entrevista — Ventas"
              className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
            />
          </label>

          <div className="mt-6 flex justify-end gap-2.5">
            <ActionButton type="button" variant="ghost" onClick={() => dialogRef.current?.close()}>
              Cancelar
            </ActionButton>
            <ActionButton type="submit" pendingLabel="Guardando…">
              Guardar
            </ActionButton>
          </div>
        </form>
      </DialogShell>
    </>
  );
}
