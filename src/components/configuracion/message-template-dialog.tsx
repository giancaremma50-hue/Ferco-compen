"use client";

import { useActionState, useEffect, useRef } from "react";
import { createMessageTemplate, updateMessageTemplate } from "@/lib/message-templates/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DialogShell, type DialogShellHandle } from "@/components/ui/dialog-shell";
import type { MessageTemplate } from "@/lib/message-templates/get-message-templates";

export function MessageTemplateDialog({
  template,
  trigger,
}: {
  template?: MessageTemplate;
  trigger: React.ReactNode;
}) {
  const dialogRef = useRef<DialogShellHandle>(null);
  const action = template ? updateMessageTemplate.bind(null, template.id) : createMessageTemplate;
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
      <DialogShell ref={dialogRef} title={template ? "Editar plantilla" : "Nueva plantilla"} maxWidthClassName="max-w-[480px]">
        <form action={formAction}>
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Nombre</span>
              <input
                name="name"
                required
                maxLength={80}
                defaultValue={template?.name}
                placeholder="Rechazo — no cumple experiencia"
                className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Asunto</span>
              <input
                name="subject"
                required
                maxLength={160}
                defaultValue={template?.subject}
                className="h-[38px] rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Cuerpo</span>
              <textarea
                name="body"
                required
                rows={6}
                maxLength={4000}
                defaultValue={template?.body}
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
