"use client";

import { useActionState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { replyToErrorReport } from "@/lib/errors/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import type { ErrorReportMessageRow } from "@/lib/errors/get-error-reports";

export function ErrorThread({
  reportId,
  messages,
  currentProfileId,
}: {
  reportId: string;
  messages: ErrorReportMessageRow[];
  currentProfileId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const action = replyToErrorReport.bind(null, reportId);
  const [state, formAction] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) {
      notifySuccess(state.success);
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <div>
      <p className="mb-4 text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Conversación</p>
      <div className="space-y-5">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no hay respuestas.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex gap-3">
            <div className="flex size-8 flex-none items-center justify-center rounded-full bg-muted text-[11px] font-medium">
              {(m.author?.display_name ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[13px] font-medium">{m.author?.display_name ?? "Alguien"}</span>
                {m.author_id === currentProfileId && (
                  <span className="rounded-sm border border-primary px-1.5 py-0.5 text-[10px] text-primary">Tú</span>
                )}
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: es })}
                </span>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line">{m.body}</p>
            </div>
          </div>
        ))}
      </div>

      <form ref={formRef} action={formAction} className="mt-6 rounded-md border border-border bg-background">
        <textarea
          name="body"
          required
          minLength={1}
          maxLength={4000}
          rows={2}
          placeholder="Responde…"
          className="w-full resize-none rounded-t-md p-3 text-sm outline-none"
        />
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <span className="text-xs text-muted-foreground">Se notifica dentro de la plataforma.</span>
          <ActionButton type="submit" variant="primary" className="h-8 px-4 text-xs" pendingLabel="Enviando…">
            Responder
          </ActionButton>
        </div>
      </form>
    </div>
  );
}
