"use client";

import { useActionState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { postErrorMessage } from "@/lib/errors/report-actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import type { ErrorReportMessage } from "@/lib/errors/get-error-reports";

export function ErrorReportThread({
  reportId,
  messages,
  currentProfileId,
}: {
  reportId: string;
  messages: ErrorReportMessage[];
  currentProfileId: string;
}) {
  const action = postErrorMessage.bind(null, reportId);
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) notifySuccess(state.success);
  }, [state]);

  return (
    <div className="mt-6">
      <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Conversación</h2>
      <div className="mt-3 flex flex-col gap-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin mensajes todavía.</p>
        ) : (
          messages.map((m) => {
            const own = m.authorId === currentProfileId;
            return (
              <div key={m.id} className={`max-w-[85%] border border-border p-3 text-sm ${own ? "self-end bg-card" : "self-start bg-background"}`}>
                <p className="text-xs font-medium text-muted-foreground">{m.authorName ?? "Alguien"}</p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                <p className="mt-1.5 text-[11px] tabular-nums text-muted-foreground">
                  {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale: es })}
                </p>
              </div>
            );
          })
        )}
      </div>

      <form action={formAction} className="mt-4 flex flex-col gap-2.5">
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Escribe un mensaje…"
          aria-invalid={state?.field === "body"}
          className={`rounded-md border bg-background p-3 text-sm ${state?.field === "body" ? "border-destructive" : "border-border"}`}
        />
        <ActionButton className="self-start">Responder</ActionButton>
      </form>
    </div>
  );
}
