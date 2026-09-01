"use client";

import { useActionState, useEffect, useRef } from "react";
import { createJobTemplate, updateJobTemplate } from "@/lib/job-templates/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DialogShell, type DialogShellHandle } from "@/components/ui/dialog-shell";
import { LabelSelect } from "@/components/ui/label-select";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/lib/jobs/schema";
import type { JobTemplate } from "@/lib/job-templates/get-job-templates";

export function JobTemplateDialog({
  template,
  trigger,
}: {
  template?: JobTemplate;
  trigger: React.ReactNode;
}) {
  const dialogRef = useRef<DialogShellHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const action = template ? updateJobTemplate.bind(null, template.id) : createJobTemplate;
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) {
      notifySuccess(state.success);
      dialogRef.current?.close();
      // Solo para "Nueva plantilla": este diálogo no se desmonta entre
      // aperturas, así que sin reset() la próxima vez que se abra para
      // crear otra plantilla seguiría mostrando lo que se acaba de guardar.
      if (!template) formRef.current?.reset();
    }
  }, [state, template]);

  return (
    <>
      <span onClick={() => dialogRef.current?.open()}>{trigger}</span>
      <DialogShell ref={dialogRef} title={template ? "Editar plantilla" : "Nueva plantilla"} maxWidthClassName="max-w-[560px]">
        <form ref={formRef} action={formAction}>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Nombre de la plantilla</span>
              <input
                name="name"
                required
                maxLength={80}
                defaultValue={template?.name}
                placeholder="Vendedor Junior"
                className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Título del puesto</span>
              <input
                name="title"
                required
                maxLength={120}
                defaultValue={template?.title}
                className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">País</span>
                <input
                  name="country"
                  required
                  maxLength={60}
                  defaultValue={template?.country}
                  className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Ubicación</span>
                <input
                  name="location"
                  required
                  maxLength={120}
                  defaultValue={template?.location}
                  className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Modalidad</span>
                <LabelSelect
                  name="work_mode"
                  required
                  labels={WORK_MODE_LABEL}
                  defaultValue={template?.work_mode ?? undefined}
                  className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Tipo de contrato</span>
                <LabelSelect
                  name="employment_type"
                  required
                  labels={EMPLOYMENT_TYPE_LABEL}
                  defaultValue={template?.employment_type ?? undefined}
                  className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Descripción del puesto</span>
              <textarea
                name="description"
                required
                rows={4}
                defaultValue={template?.description}
                className="rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-foreground"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Requisitos</span>
              <textarea
                name="requirements"
                required
                rows={3}
                defaultValue={template?.requirements}
                className="rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-foreground"
              />
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
