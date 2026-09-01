"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import type { CandidacyFields } from "@/lib/job-templates/candidacy-fields";

const FIELD_CLASS = "h-11 rounded-md border border-border bg-background px-3 text-sm";

export type PublicQuestion = {
  id: string;
  prompt: string;
  type: string;
  job_question_options: { id: string; label: string }[];
};

export function ApplicationForm({
  jobId,
  candidacyFields,
  questions,
}: {
  jobId: string;
  candidacyFields: CandidacyFields;
  questions: PublicQuestion[];
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("job_id", jobId);

    try {
      const res = await fetch("/api/postular", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "No se pudo enviar tu postulación.");
        return;
      }
      notifySuccess("Postulación enviada");
      router.push("/empleos");
    } catch {
      setError("Se perdió la conexión. Tus datos no se enviaron — inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={pending}>
      {candidacyFields.full_name !== "hidden" && (
        <input
          name="full_name"
          required={candidacyFields.full_name === "required"}
          placeholder="Nombre completo"
          className={FIELD_CLASS}
        />
      )}
      <input name="email" type="email" required placeholder="Correo" className={FIELD_CLASS} />
      {candidacyFields.phone !== "hidden" && (
        <input
          name="phone"
          required={candidacyFields.phone === "required"}
          placeholder="Teléfono"
          className={FIELD_CLASS}
        />
      )}
      {candidacyFields.address !== "hidden" && (
        <input
          name="address"
          required={candidacyFields.address === "required"}
          placeholder="Dirección"
          className={FIELD_CLASS}
        />
      )}
      <input name="current_title" placeholder="Puesto actual (opcional)" className={FIELD_CLASS} />

      {candidacyFields.resume !== "hidden" && (
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Currículum (PDF, máx. 10 MB){candidacyFields.resume === "optional" && " — opcional"}
          <input
            name="cv"
            type="file"
            accept="application/pdf"
            required={candidacyFields.resume === "required"}
            className="text-sm"
          />
        </label>
      )}

      {candidacyFields.cover_letter !== "hidden" && (
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Carta de motivación{candidacyFields.cover_letter === "optional" && " (opcional)"}
          <textarea
            name="cover_letter"
            required={candidacyFields.cover_letter === "required"}
            rows={4}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
      )}

      {candidacyFields.additional_files !== "hidden" && (
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Archivos adicionales (PDF, JPG o PNG){candidacyFields.additional_files === "optional" && " — opcional"}
          <input
            name="additional_files"
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            multiple
            required={candidacyFields.additional_files === "required"}
            className="text-sm"
          />
        </label>
      )}

      {questions.length > 0 && (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          {questions.map((question) => (
            <label key={question.id} className="flex flex-col gap-2 text-sm">
              {question.prompt}
              {question.type === "multiple_choice" ? (
                <div className="flex flex-col gap-1.5">
                  {question.job_question_options.map((option) => (
                    <label key={option.id} className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                      <input type="radio" name={`answer_${question.id}`} value={option.id} className="size-4" />
                      {option.label}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea name={`answer_${question.id}`} rows={2} className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
              )}
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ActionButton pending={pending} pendingLabel="Enviando…" className="h-11 w-full">
        Enviar postulación
      </ActionButton>
    </form>
  );
}
