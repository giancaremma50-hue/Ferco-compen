"use client";

import { useTransition } from "react";
import { hireApplication } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";

export function HireButton({ applicationId, onSuccess }: { applicationId: string; onSuccess?: () => void }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await hireApplication(applicationId);
      if (result.error) notifyError(result.error);
      else {
        notifySuccess(result.success ?? "Candidato contratado");
        onSuccess?.();
      }
    });
  }

  return (
    <ActionButton type="button" pending={pending} pendingLabel="Contratando…" onClick={handleClick}>
      Contratar
    </ActionButton>
  );
}
