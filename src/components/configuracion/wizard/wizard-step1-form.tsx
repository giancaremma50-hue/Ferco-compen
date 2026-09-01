"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { createTemplateDraftStep1 } from "@/lib/job-templates/wizard-actions";
import { notifyError } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { LabelSelect } from "@/components/ui/label-select";
import { CompetencyListEditor } from "@/components/configuracion/competency-list-editor";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/lib/jobs/schema";

const FIELD_CLASS = "h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-foreground";
const TEXTAREA_CLASS = "rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground";

export function WizardStep1Form({ departments }: { departments: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(createTemplateDraftStep1, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Puesto</span>
        <input name="name" required maxLength={80} placeholder="Vendedor Junior" className={FIELD_CLASS} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Título del anuncio de la vacante</span>
        <input name="title" required maxLength={120} className={FIELD_CLASS} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Departamento (opcional)</span>
        <select name="department_id" defaultValue="" className={FIELD_CLASS}>
          <option value="">Sin asignar</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">País</span>
          <input name="country" required maxLength={60} className={FIELD_CLASS} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Ubicación</span>
          <input name="location" required maxLength={120} className={FIELD_CLASS} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Modalidad</span>
          <LabelSelect name="work_mode" required labels={WORK_MODE_LABEL} className={FIELD_CLASS} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Tipo de contrato</span>
          <LabelSelect name="employment_type" required labels={EMPLOYMENT_TYPE_LABEL} className={FIELD_CLASS} />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Descripción del puesto</span>
        <textarea name="description" required rows={4} className={TEXTAREA_CLASS} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Requisitos</span>
        <textarea name="requirements" required rows={3} className={TEXTAREA_CLASS} />
      </label>

      <div className="border-t border-border pt-4">
        <span className="text-xs text-muted-foreground">Rúbrica de evaluación (opcional)</span>
        <div className="mt-1.5">
          <CompetencyListEditor initialCompetencies={[]} />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2.5">
        <Link
          href="/configuracion/plantillas-vacante"
          className="inline-flex h-[42px] items-center rounded-md border border-transparent px-5 text-sm text-muted-foreground hover:bg-muted"
        >
          Cancelar
        </Link>
        <ActionButton type="submit" pendingLabel="Guardando…">
          Siguiente
        </ActionButton>
      </div>
    </form>
  );
}
