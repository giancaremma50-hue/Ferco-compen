"use client";

import Link from "next/link";
import { useTransition } from "react";
import { setDefaultPipelineTemplate, deletePipelineTemplate } from "@/lib/pipeline-templates/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { DeleteButton } from "@/components/ui/delete-button";
import type { PipelineTemplateRow as Row } from "@/lib/pipeline-templates/get-pipeline-templates";

export function PipelineTemplateRow({ template }: { template: Row }) {
  const [pending, startTransition] = useTransition();

  function handleSetDefault() {
    startTransition(async () => {
      const result = await setDefaultPipelineTemplate(template.id);
      if (result.error) notifyError(result.error);
      else notifySuccess(result.success ?? "Actualizado");
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 px-1 py-3 text-sm">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/configuracion/pipelines/${template.id}`} className="truncate font-medium underline">
            {template.name}
          </Link>
          {template.is_default && (
            <span className="rounded-sm border border-accent px-1.5 py-0.5 text-[10px] text-accent">
              Predeterminada
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {template.stage_count} {template.stage_count === 1 ? "etapa" : "etapas"}
        </p>
      </div>
      <div className="flex flex-none items-center gap-2">
        {!template.is_default && (
          <ActionButton
            type="button"
            variant="secondary"
            className="h-8 px-3 text-xs"
            pending={pending}
            onClick={handleSetDefault}
          >
            Marcar predeterminada
          </ActionButton>
        )}
        {!template.is_default && (
          <DeleteButton
            itemLabel={`la plantilla "${template.name}"`}
            iconOnly
            onDelete={() => deletePipelineTemplate(template.id)}
            successMessage="Plantilla eliminada"
          />
        )}
      </div>
    </div>
  );
}
