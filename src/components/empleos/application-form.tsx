"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import type { CandidacyFields } from "@/lib/job-templates/candidacy-fields";

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
  const [errorField, setErrorField] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setErrorField(null);

    const formData = new FormData(e.currentTarget);
    formData.set("job_id", jobId);

    try {
      const res = await fetch("/api/postular", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "No se pudo enviar tu postulación.");
        setErrorField(body.field ?? null);
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

  function fieldClass(name: string) {
    return `h-11 rounded-md border bg-background px-3 text-sm ${errorField === name ? "border-destructive" : "border-border"}`;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={pending}>
      {candidacyFields.full_name !== "hidden" && (
        <input
          name="full_name"
          required={candidacyFields.full_name === "required"}
          placeholder="Nombre completo"
          aria-invalid={errorField === "full_name"}
          className={fieldClass("full_name")}
        />
      )}
      <input
        name="email"
        type="email"
        required
        placeholder="Correo"
        aria-invalid={errorField === "email"}
        className={fieldClass("email")}
      />
      {candidacyFields.phone !== "hidden" && (
        <input
          name="phone"
          required={candidacyFields.phone === "required"}
          placeholder="Teléfono"
          aria-invalid={errorField === "phone"}
          className={fieldClass("phone")}
        />
      )}
      {candidacyFields.address !== "hidden" && (
        <input
          name="address"
          required={candidacyFields.address === "required"}
          placeholder="Dirección"
          aria-invalid={errorField === "address"}
          className={fieldClass("address")}
        />
      )}
      <input
        name="current_title"
        placeholder="Puesto actual (opcional)"
        aria-invalid={errorField === "current_title"}
        className={fieldClass("current_title")}
      />

      {candidacyFields.resume !== "hidden" && (
        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Currículum (PDF, máx. 10 MB){candidacyFields.resume === "optional" && " — opcional"}
          <input
            name="cv"
            type="file"
            accept="application/pdf"
            required={candidacyFields.resume === "required"}
            aria-invalid={errorField === "cv"}
            className={`text-sm ${errorField === "cv" ? "text-destructive" : ""}`}
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

      {/* Sin marcar por defecto y `required`: el navegador ya frena el envío,
          y /api/postular lo vuelve a exigir con Zod — quitar el atributo desde
          las herramientas del navegador no alcanza para saltarlo. */}
      <label className="flex items-start gap-2.5 border-t border-border pt-4 text-sm">
        <input
          type="checkbox"
          name="privacy_consent"
          required
          className="mt-0.5 size-4 flex-none"
        />
        {/* Sin aria-describedby: este span YA es la etiqueta de la casilla (va
            dentro del <label>), y apuntarlo también como descripción hace que
            un lector de pantalla lea la frase completa dos veces. */}
        <span className="text-foreground/90">
          He leído y acepto la{" "}
          <Link href="/privacidad" target="_blank" className="font-medium text-accent underline">
            política de privacidad y tratamiento de datos
          </Link>
          , y autorizo el uso de la información y los archivos que envío para evaluar mi candidatura.
        </span>
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ActionButton pending={pending} pendingLabel="Enviando…" className="h-11 w-full">
        Enviar postulación
      </ActionButton>
    </form>
  );
}
