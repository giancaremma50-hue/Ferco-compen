"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { updateTemplateStep3 } from "@/lib/job-templates/wizard-actions";
import { notifyError } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { QuestionListEditor } from "@/components/configuracion/wizard/question-list-editor";
import type { QuestionDraft } from "@/lib/job-templates/wizard-schema";

export function WizardStep3Form({ templateId, initialQuestions }: { templateId: string; initialQuestions: QuestionDraft[] }) {
  const action = updateTemplateStep3.bind(null, templateId);
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <QuestionListEditor initialQuestions={initialQuestions} />

      <div className="mt-6 flex justify-end gap-2.5">
        <Link
          href={`/configuracion/plantillas-vacante/${templateId}/paso-2`}
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
