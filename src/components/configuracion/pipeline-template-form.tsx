"use client";

import { useActionState, useEffect } from "react";
import { createPipelineTemplate, updatePipelineTemplate } from "@/lib/pipeline-templates/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { PipelineStagesEditor } from "@/components/configuracion/pipeline-stages-editor";
import type { StageType } from "@/lib/pipeline-templates/schema";

export function PipelineTemplateForm({
  template,
}: {
  template?: { id: string; name: string; stages: { name: string; type: StageType }[] };
}) {
  const action = template ? updatePipelineTemplate.bind(null, template.id) : createPipelineTemplate;
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) notifySuccess(state.success);
  }, [state]);

  return (
    <form action={formAction} className="border border-border bg-card p-6">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Nombre de la plantilla</span>
        <input
          name="name"
          required
          defaultValue={template?.name}
          className="h-[38px] max-w-md rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
        />
      </label>

      <div className="mt-6">
        <span className="text-xs text-muted-foreground">Etapas, en orden</span>
        <div className="mt-2">
          <PipelineStagesEditor initialStages={template?.stages ?? []} />
        </div>
      </div>

      <div className="mt-6">
        <ActionButton type="submit" pendingLabel="Guardando…">
          Guardar plantilla
        </ActionButton>
      </div>
    </form>
  );
}
