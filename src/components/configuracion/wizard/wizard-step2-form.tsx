"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { updateTemplateStep2 } from "@/lib/job-templates/wizard-actions";
import { notifyError } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { CANDIDACY_FIELD_LABEL, CANDIDACY_STATE_LABEL, type CandidacyFields, type CandidacyFieldKey } from "@/lib/job-templates/candidacy-fields";

const FIELD_KEYS = Object.keys(CANDIDACY_FIELD_LABEL) as CandidacyFieldKey[];

export function WizardStep2Form({ templateId, initialFields }: { templateId: string; initialFields: CandidacyFields }) {
  const action = updateTemplateStep2.bind(null, templateId);
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col divide-y divide-border rounded-md border border-border">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm">Correo electrónico</span>
          <span className="text-xs text-muted-foreground">Obligatorio — no se puede cambiar</span>
        </div>
        {FIELD_KEYS.map((key) => (
          <div key={key} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm">{CANDIDACY_FIELD_LABEL[key]}</span>
            <select
              name={key}
              defaultValue={initialFields[key]}
              className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
            >
              {Object.entries(CANDIDACY_STATE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end gap-2.5">
        <Link
          href={`/configuracion/plantillas-vacante/${templateId}/paso-1`}
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
