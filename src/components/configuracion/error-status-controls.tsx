"use client";

import { useTransition } from "react";
import { updateErrorReportStatus, updateErrorReportSeverity } from "@/lib/errors/report-actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { STATUS_LABEL, SEVERITY_LABEL, STATUS_OPTIONS, SEVERITY_OPTIONS } from "@/lib/errors/status-labels";
import type { Database } from "@/lib/supabase/database.types";

export function ErrorStatusControls({
  reportId,
  status,
  severity,
}: {
  reportId: string;
  status: Database["public"]["Enums"]["error_status"];
  severity: Database["public"]["Enums"]["error_severity"];
}) {
  const [pending, startTransition] = useTransition();

  function handleStatusChange(value: string) {
    startTransition(async () => {
      const res = await updateErrorReportStatus(reportId, value);
      if (res.error) notifyError(res.error);
      else if (res.success) notifySuccess(res.success);
    });
  }

  function handleSeverityChange(value: string) {
    startTransition(async () => {
      const res = await updateErrorReportSeverity(reportId, value);
      if (res.error) notifyError(res.error);
      else if (res.success) notifySuccess(res.success);
    });
  }

  return (
    <div className="flex gap-3">
      <select
        defaultValue={status}
        disabled={pending}
        onChange={(e) => handleStatusChange(e.target.value)}
        className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <select
        defaultValue={severity}
        disabled={pending}
        onChange={(e) => handleSeverityChange(e.target.value)}
        className="h-9 rounded-md border border-border bg-background px-2.5 text-sm"
      >
        {SEVERITY_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {SEVERITY_LABEL[s]}
          </option>
        ))}
      </select>
    </div>
  );
}
