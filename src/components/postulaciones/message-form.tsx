"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendCandidateMessage } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import type { MessageTemplate } from "@/lib/message-templates/get-message-templates";

export function MessageForm({
  applicationId,
  templates,
}: {
  applicationId: string;
  templates: MessageTemplate[];
}) {
  const action = sendCandidateMessage.bind(null, applicationId);
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  // No controladas: precargar desde una plantilla solo escribe el DOM
  // directo (igual que un reset nativo del form), sin pasar por setState —
  // necesario para que el reset tras enviar no dispare otro render en el
  // mismo efecto que muestra el toast.
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state?.error) notifyError(state.error);
    else if (state?.success) {
      notifySuccess(state.success);
      formRef.current?.reset();
    }
  }, [state]);

  function applyTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    if (!template || !subjectRef.current || !bodyRef.current) return;
    subjectRef.current.value = template.subject;
    bodyRef.current.value = template.body;
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2.5">
      {templates.length > 0 && (
        <select
          defaultValue=""
          onChange={(e) => applyTemplate(e.target.value)}
          className="h-9 rounded-md border border-border bg-background px-2.5 text-xs"
        >
          <option value="">Usar una plantilla…</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      <input
        ref={subjectRef}
        name="subject"
        required
        maxLength={160}
        placeholder="Asunto"
        className="h-9 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
      />
      <textarea
        ref={bodyRef}
        name="body"
        required
        rows={4}
        maxLength={4000}
        placeholder="Escribe el mensaje para el candidato…"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="flex justify-end">
        <ActionButton className="h-9 px-4 text-xs" pendingLabel="Enviando…">
          Enviar mensaje
        </ActionButton>
      </div>
    </form>
  );
}
