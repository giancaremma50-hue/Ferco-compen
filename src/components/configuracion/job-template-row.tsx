"use client";

import Link from "next/link";
import { deleteJobTemplate } from "@/lib/job-templates/actions";
import { DeleteButton } from "@/components/ui/delete-button";
import { JobTemplateDialog } from "./job-template-dialog";
import type { JobTemplate } from "@/lib/job-templates/get-job-templates";

export function JobTemplateRow({
  template,
  pipelineTemplates,
}: {
  template: JobTemplate;
  pipelineTemplates: { id: string; name: string }[];
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 px-1 py-3 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{template.name}</p>
          {template.status === "draft" && (
            <span className="flex-none rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
              Borrador
            </span>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{template.title}</p>
      </div>
      <div className="flex flex-none items-center gap-2">
        {template.status === "draft" && (
          <Link
            href={`/configuracion/plantillas-vacante/${template.id}/paso-2`}
            className="flex h-8 items-center rounded-md border border-border px-3 text-xs"
          >
            Continuar
          </Link>
        )}
        <JobTemplateDialog
          // key por updated_at: fuerza a remontar el diálogo cuando la
          // fila cambió (ej. tras una edición ya guardada) — sin esto, el
          // formulario no controlado se queda con el defaultValue viejo si
          // se reabre "Editar" sobre la misma plantilla sin recargar.
          key={template.updated_at}
          template={template}
          pipelineTemplates={pipelineTemplates}
          trigger={
            <button type="button" className="h-8 rounded-md border border-border px-3 text-xs">
              Editar
            </button>
          }
        />
        <DeleteButton
          itemLabel={`la plantilla "${template.name}"`}
          iconOnly
          onDelete={() => deleteJobTemplate(template.id)}
          successMessage="Plantilla eliminada"
        />
      </div>
    </div>
  );
}
