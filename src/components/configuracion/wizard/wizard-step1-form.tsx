"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { createTemplateDraftStep1, updateTemplateStep1 } from "@/lib/job-templates/wizard-actions";
import { notifyError } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { LabelSelect } from "@/components/ui/label-select";
import { CompetencyListEditor } from "@/components/configuracion/competency-list-editor";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/lib/jobs/schema";
import type { CompetencyDraft } from "@/lib/job-templates/schema";

const FIELD_CLASS = "h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-foreground";
const TEXTAREA_CLASS = "rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground";

export type Step1InitialValues = {
  name: string;
  title: string;
  department_id: string | null;
  country: string;
  location: string;
  work_mode: string;
  employment_type: string;
  description: string;
  requirements: string;
  competencies: CompetencyDraft[];
};

/**
 * Sin `templateId`: crea una plantilla nueva (Siguiente → paso 2 recién
 * creado). Con `templateId`: reedita el paso 1 de una plantilla ya
 * existente (llegado desde "Atrás" del paso 2, o "Continuar" en el
 * listado) — mismo patrón create-vs-update que JobTemplateDialog.
 */
export function WizardStep1Form({
  departments,
  templateId,
  initialValues,
}: {
  departments: { id: string; name: string }[];
  templateId?: string;
  initialValues?: Step1InitialValues;
}) {
  const action = templateId ? updateTemplateStep1.bind(null, templateId) : createTemplateDraftStep1;
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1" data-tour="w1-puesto">
        <span className="text-xs text-muted-foreground">Puesto</span>
        <input
          name="name"
          required
          maxLength={80}
          placeholder="Vendedor Junior"
          defaultValue={initialValues?.name}
          className={FIELD_CLASS}
        />
      </label>
      <label className="flex flex-col gap-1" data-tour="w1-titulo">
        <span className="text-xs text-muted-foreground">Título del anuncio de la vacante</span>
        <input name="title" required maxLength={120} defaultValue={initialValues?.title} className={FIELD_CLASS} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Departamento (opcional)</span>
        <select name="department_id" defaultValue={initialValues?.department_id ?? ""} className={FIELD_CLASS}>
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
          <input name="country" required maxLength={60} defaultValue={initialValues?.country} className={FIELD_CLASS} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Ubicación</span>
          <input name="location" required maxLength={120} defaultValue={initialValues?.location} className={FIELD_CLASS} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Modalidad</span>
          <LabelSelect
            name="work_mode"
            required
            labels={WORK_MODE_LABEL}
            defaultValue={initialValues?.work_mode}
            className={FIELD_CLASS}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Tipo de contrato</span>
          <LabelSelect
            name="employment_type"
            required
            labels={EMPLOYMENT_TYPE_LABEL}
            defaultValue={initialValues?.employment_type}
            className={FIELD_CLASS}
          />
        </label>
      </div>
      <label className="flex flex-col gap-1" data-tour="w1-descripcion">
        <span className="text-xs text-muted-foreground">Descripción del puesto</span>
        <textarea name="description" required rows={4} defaultValue={initialValues?.description} className={TEXTAREA_CLASS} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Requisitos</span>
        <textarea name="requirements" required rows={3} defaultValue={initialValues?.requirements} className={TEXTAREA_CLASS} />
      </label>

      <div className="border-t border-border pt-4" data-tour="w1-rubrica">
        <span className="text-xs text-muted-foreground">Rúbrica de evaluación (opcional)</span>
        <div className="mt-1.5">
          <CompetencyListEditor initialCompetencies={initialValues?.competencies ?? []} />
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
