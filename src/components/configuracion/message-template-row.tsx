"use client";

import { deleteMessageTemplate } from "@/lib/message-templates/actions";
import { DeleteButton } from "@/components/ui/delete-button";
import { MessageTemplateDialog } from "./message-template-dialog";
import type { MessageTemplate } from "@/lib/message-templates/get-message-templates";

export function MessageTemplateRow({ template }: { template: MessageTemplate }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 px-1 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{template.name}</p>
        <p className="truncate text-xs text-muted-foreground">{template.subject}</p>
      </div>
      <div className="flex flex-none items-center gap-2">
        <MessageTemplateDialog
          template={template}
          trigger={
            <button type="button" className="h-8 rounded-md border border-border px-3 text-xs">
              Editar
            </button>
          }
        />
        <DeleteButton
          itemLabel={`la plantilla "${template.name}"`}
          iconOnly
          onDelete={() => deleteMessageTemplate(template.id)}
          successMessage="Plantilla eliminada"
        />
      </div>
    </div>
  );
}
