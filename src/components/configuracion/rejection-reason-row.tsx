"use client";

import { useTransition } from "react";
import { toggleRejectionReason } from "@/lib/rejection-reasons/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";

export function RejectionReasonRow({ reason }: { reason: { id: string; label: string; is_active: boolean } }) {
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleRejectionReason(reason.id, !reason.is_active);
      if (result.error) notifyError(result.error);
      else notifySuccess(result.success ?? "Actualizado");
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 px-1 py-3 text-sm">
      <span className={reason.is_active ? "" : "text-muted-foreground line-through"}>{reason.label}</span>
      <ActionButton
        type="button"
        variant={reason.is_active ? "secondary" : "primary"}
        pending={pending}
        pendingLabel={reason.is_active ? "Desactivando…" : "Activando…"}
        onClick={handleToggle}
        className="h-8 px-3 text-xs"
      >
        {reason.is_active ? "Activo" : "Inactivo"}
      </ActionButton>
    </div>
  );
}
