"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";

export function ApplicationForm({ jobId }: { jobId: string }) {
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
      <input
        name="full_name"
        required
        placeholder="Nombre completo"
        aria-invalid={errorField === "full_name"}
        className={fieldClass("full_name")}
      />
      <input
        name="email"
        type="email"
        required
        placeholder="Correo"
        aria-invalid={errorField === "email"}
        className={fieldClass("email")}
      />
      <input
        name="phone"
        required
        placeholder="Teléfono"
        aria-invalid={errorField === "phone"}
        className={fieldClass("phone")}
      />
      <input
        name="current_title"
        placeholder="Puesto actual (opcional)"
        aria-invalid={errorField === "current_title"}
        className={fieldClass("current_title")}
      />
      <label className="flex flex-col gap-2 text-sm text-muted-foreground">
        Currículum (PDF, máx. 10 MB)
        <input
          name="cv"
          type="file"
          accept="application/pdf"
          required
          aria-invalid={errorField === "cv"}
          className={`text-sm ${errorField === "cv" ? "text-destructive" : ""}`}
        />
      </label>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <ActionButton pending={pending} pendingLabel="Enviando…" className="h-11 w-full">
        Enviar postulación
      </ActionButton>
    </form>
  );
}
