"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { publishTemplate, saveTemplateAsDraft } from "@/lib/job-templates/wizard-actions";
import { notifyError } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";

function DraftForm({ templateId }: { templateId: string }) {
  const action = saveTemplateAsDraft.bind(null, templateId);
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <ActionButton type="submit" variant="secondary" pendingLabel="Guardando…">
        Crear borrador
      </ActionButton>
    </form>
  );
}

function PublishForm({ templateId }: { templateId: string }) {
  const action = publishTemplate.bind(null, templateId);
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <ActionButton type="submit" pendingLabel="Publicando…">
        Crear plantilla
      </ActionButton>
    </form>
  );
}

export function WizardStep6Form({ templateId, templateName }: { templateId: string; templateName: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border border-border p-4">
        <p className="text-sm">
          <span className="font-medium">{templateName}</span> queda lista. &ldquo;Crear plantilla&rdquo; la publica —
          recién ahí se puede elegir al solicitar una vacante. &ldquo;Crear borrador&rdquo; la deja guardada tal
          cual, para retomarla después desde el listado.
        </p>
      </div>

      <div className="flex justify-end gap-2.5">
        <Link
          href={`/configuracion/plantillas-vacante/${templateId}/paso-5`}
          className="inline-flex h-[42px] items-center rounded-md border border-border px-5 text-sm text-muted-foreground hover:bg-muted"
        >
          Atrás
        </Link>
        <DraftForm templateId={templateId} />
        <PublishForm templateId={templateId} />
      </div>
    </div>
  );
}
