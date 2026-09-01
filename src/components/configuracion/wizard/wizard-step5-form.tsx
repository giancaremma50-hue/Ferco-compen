"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { updateTemplateStep5 } from "@/lib/job-templates/wizard-actions";
import { notifyError } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";

export function WizardStep5Form({ templateId, isConfidential }: { templateId: string; isConfidential: boolean }) {
  const action = updateTemplateStep5.bind(null, templateId);
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex items-start justify-between gap-4 rounded-md border border-border p-4">
        <span>
          <span className="block text-sm font-medium">Confidencial</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Solo vos vas a poder ver esta plantilla en el bolsón — al resto de la organización no le aparece, ni
            siquiera a otro admin.
          </span>
        </span>
        <input type="checkbox" name="is_confidential" defaultChecked={isConfidential} className="mt-1 size-4 flex-none" />
      </label>

      <div className="mt-6 flex justify-end gap-2.5">
        <Link
          href={`/configuracion/plantillas-vacante/${templateId}/paso-4`}
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
