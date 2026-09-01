"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { updateTemplateStep4 } from "@/lib/job-templates/wizard-actions";
import { notifyError } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { TemplateStagesEditor } from "@/components/configuracion/wizard/template-stages-editor";
import type { TemplateStageDraft } from "@/lib/job-templates/wizard-schema";
import type { PipelineTemplateWithStages } from "@/lib/pipeline-templates/get-pipeline-templates";

export function WizardStep4Form({
  templateId,
  initialStages,
  savedSets,
}: {
  templateId: string;
  initialStages: TemplateStageDraft[];
  savedSets: PipelineTemplateWithStages[];
}) {
  const action = updateTemplateStep4.bind(null, templateId);
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TemplateStagesEditor initialStages={initialStages} savedSets={savedSets} />

      <div className="mt-6 flex justify-end gap-2.5">
        <Link
          href={`/configuracion/plantillas-vacante/${templateId}/paso-3`}
          className="inline-flex h-[42px] items-center rounded-md border border-border px-5 text-sm text-muted-foreground hover:bg-muted"
        >
          Atrás
        </Link>
        <ActionButton type="submit" pendingLabel="Guardando…">
          Siguiente
        </ActionButton>
      </div>
    </form>
  );
}
