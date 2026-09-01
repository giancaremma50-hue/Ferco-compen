"use client";

import { useRef } from "react";
import { JobForm } from "./job-form";
import { createJob } from "@/lib/jobs/actions";

// Solo los campos visibles del formulario — createJob vuelve a consultar
// pipeline_template_id/competencies server-side a partir del id (nunca
// confía en contenido mandado por el cliente para esa parte, ver actions.ts).
export type JobTemplateOption = {
  id: string;
  name: string;
  title: string;
  country: string;
  location: string;
  work_mode: string;
  employment_type: string;
  description: string;
  requirements: string;
};

function fillIfEmpty(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name);
  if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) && !el.value.trim()) {
    el.value = value;
  }
}

function setHidden(form: HTMLFormElement, name: string, value: string) {
  const el = form.elements.namedItem(name);
  if (el instanceof HTMLInputElement) el.value = value;
}

export function NuevaVacanteForm({
  departments,
  templates,
}: {
  departments: { id: string; name: string }[];
  templates: JobTemplateOption[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  function applyTemplate(templateId: string) {
    const form = formRef.current;
    if (!form) return;

    const template = templates.find((t) => t.id === templateId);
    if (!template) {
      // "En blanco" (o un id que ya no existe): esta vacante no queda
      // asociada a ninguna plantilla, aunque antes se hubiera elegido una.
      setHidden(form, "template_id", "");
      return;
    }

    // Solo llena lo que está vacío — si ya escribiste algo a mano antes de
    // elegir una plantilla, eso queda tal cual.
    fillIfEmpty(form, "title", template.title);
    fillIfEmpty(form, "country", template.country);
    fillIfEmpty(form, "location", template.location);
    fillIfEmpty(form, "work_mode", template.work_mode);
    fillIfEmpty(form, "employment_type", template.employment_type);
    fillIfEmpty(form, "description", template.description);
    fillIfEmpty(form, "requirements", template.requirements);

    setHidden(form, "template_id", template.id);
  }

  return (
    <>
      {templates.length > 0 && (
        <div className="mb-8 flex flex-col gap-2">
          <label htmlFor="plantilla" className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
            Empezar desde una plantilla (opcional)
          </label>
          <select
            id="plantilla"
            defaultValue=""
            onChange={(e) => applyTemplate(e.target.value)}
            className="h-11 rounded-md border border-border bg-background px-3 text-sm"
          >
            <option value="">En blanco</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Solo llena los campos que dejes vacíos — lo que ya escribiste no se pisa.</p>
        </div>
      )}
      <JobForm ref={formRef} action={createJob} departments={departments} submitLabel="Crear vacante">
        <input type="hidden" name="template_id" />
      </JobForm>
    </>
  );
}
