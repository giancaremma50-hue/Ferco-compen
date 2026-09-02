"use client";

import Link from "next/link";
import { deleteJobTemplate } from "@/lib/job-templates/actions";
import { DeleteButton } from "@/components/ui/delete-button";
import type { JobTemplate } from "@/lib/job-templates/get-job-templates";

export function JobTemplateRow({ template }: { template: JobTemplate }) {
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
        <Link
          href={
            template.status === "draft"
              ? `/configuracion/plantillas-vacante/${template.id}/paso-${template.wizard_step}`
              : `/configuracion/plantillas-vacante/${template.id}/paso-1`
          }
          className="flex h-8 items-center rounded-md border border-border px-3 text-xs"
        >
          {template.status === "draft" ? "Continuar" : "Editar"}
        </Link>
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
