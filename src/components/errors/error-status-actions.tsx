"use client";

import { useTransition } from "react";
import { updateErrorReportStatus } from "@/lib/errors/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { ERROR_STATUS_LABEL } from "@/lib/errors/schema";
import type { Database } from "@/lib/supabase/database.types";

type ErrorStatus = Database["public"]["Enums"]["error_status"];

export function ErrorStatusActions({ reportId, status }: { reportId: string; status: ErrorStatus }) {
  const [pending, startTransition] = useTransition();

  function change(next: ErrorStatus) {
    startTransition(async () => {
      const result = await updateErrorReportStatus(reportId, status, next);
      if (result.error) notifyError(result.error);
      else notifySuccess(`Marcado como "${ERROR_STATUS_LABEL[next]}"`);
    });
  }

  return (
    <div className="flex gap-2">
      {status !== "en_revision" && status !== "resuelto" && (
        <ActionButton
          type="button"
          variant="secondary"
          className="h-8 px-3 text-xs"
          pending={pending}
          onClick={() => change("en_revision")}
        >
          Marcar en revisión
        </ActionButton>
      )}
      {status !== "resuelto" && (
        <ActionButton type="button" variant="primary" className="h-8 px-3 text-xs" pending={pending} onClick={() => change("resuelto")}>
          Resolver
        </ActionButton>
      )}
      {status !== "descartado" && status !== "resuelto" && (
        <ActionButton type="button" variant="ghost" className="h-8 px-3 text-xs" pending={pending} onClick={() => change("descartado")}>
          Descartar
        </ActionButton>
      )}
    </div>
  );
}
