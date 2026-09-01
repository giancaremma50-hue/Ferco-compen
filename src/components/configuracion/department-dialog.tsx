"use client";

import { useActionState, useEffect, useRef } from "react";
import { createDepartment, updateDepartment } from "@/lib/departments/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DialogShell, type DialogShellHandle } from "@/components/ui/dialog-shell";
import type { DepartmentAdminRow, SelectableProfile } from "@/lib/departments/get-departments-admin";

export function DepartmentDialog({
  department,
  profiles,
  trigger,
}: {
  department?: DepartmentAdminRow;
  profiles: SelectableProfile[];
  trigger: React.ReactNode;
}) {
  const dialogRef = useRef<DialogShellHandle>(null);
  const action = department ? updateDepartment.bind(null, department.id) : createDepartment;
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) {
      notifySuccess(state.success);
      dialogRef.current?.close();
    }
  }, [state]);

  return (
    <>
      <span onClick={() => dialogRef.current?.open()}>{trigger}</span>
      <DialogShell ref={dialogRef} title={department ? "Editar departamento" : "Nuevo departamento"} maxWidthClassName="max-w-[420px]">
        <form action={formAction}>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Nombre</span>
              <input
                name="name"
                required
                defaultValue={department?.name}
                className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">País (opcional)</span>
              <input
                name="country"
                defaultValue={department?.country ?? ""}
                className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Responsable (opcional)</span>
              <select
                name="head_profile_id"
                defaultValue={department?.head_profile_id ?? ""}
                className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm"
              >
                <option value="">Sin asignar</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name}
                  </option>
                ))}
              </select>
            </label>
          </div>

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
