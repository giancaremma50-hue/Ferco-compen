"use client";

import { useTransition } from "react";
import { markAllAsRead } from "@/lib/notifications/mark-read-actions";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";

export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await markAllAsRead();
      notifySuccess("Notificaciones marcadas como leídas");
    });
  }

  return (
    <ActionButton type="button" variant="secondary" pending={pending} pendingLabel="Marcando…" onClick={handleClick}>
      Marcar todas como leídas
    </ActionButton>
  );
}
