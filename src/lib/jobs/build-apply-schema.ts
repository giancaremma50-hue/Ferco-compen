import { z } from "zod";
import { optionalText } from "@/lib/zod-helpers";
import type { CandidacyFields, CandidacyState } from "@/lib/job-templates/candidacy-fields";

function fieldSchema(state: CandidacyState, max: number, requiredMessage: string) {
  if (state === "required") {
    return z.string().trim().min(1, { error: requiredMessage }).max(max, { error: `Máximo ${max} caracteres.` });
  }
  return optionalText(max);
}

// El shape real depende de candidacyFields (algunas claves ni existen si el
// campo está "hidden"), así que TypeScript no puede inferirlo desde
// z.object(shape: Record<string, ZodTypeAny>) — se declara la forma final
// a mano una sola vez y se afirma al devolver el schema. Sigue siendo
// seguro: las mismas claves que arma el schema abajo son las que este tipo
// declara, ambas leen la misma `candidacyFields`.
export type ApplyFormValues = {
  job_id: string;
  email: string;
  current_title?: string;
  years_experience?: number;
  full_name?: string;
  phone?: string;
  address?: string;
  cover_letter?: string;
};

/**
 * Arma el schema de validación del formulario público según
 * `jobs.candidacy_fields` de ESA vacante — cada vacante puede pedir un set
 * de campos distinto (paso "Candidatura" del wizard). `email` es siempre
 * obligatorio, fijo, nunca lee el estado de `candidacyFields.email` (que
 * de todos modos siempre vale "required", forzado server-side desde
 * updateTemplateStep2 — ver ese comentario).
 *
 * Los campos en `"hidden"` no entran al schema en absoluto: el formulario
 * no los renderiza, y si de todos modos llegaran en el POST (ej. un cliente
 * fabricado a mano), Zod los descarta en modo "strip" por defecto —
 * `current_title`/`years_experience` quedan fuera del tri-estado a
 * propósito, el usuario no los mencionó al listar los 7 campos
 * configurables.
 */
export function buildApplySchema(candidacyFields: CandidacyFields): z.ZodType<ApplyFormValues> {
  const shape: Record<string, z.ZodTypeAny> = {
    job_id: z.uuid({ error: "Vacante inválida." }),
    email: z.email({ error: "Correo inválido." }),
    current_title: optionalText(120),
    years_experience: z.preprocess(
      (v) => (v === "" || v == null ? undefined : Number(v)),
      z
        .number()
        .int({ error: "Revisa los años de experiencia." })
        .min(0, { error: "Revisa los años de experiencia." })
        .max(60, { error: "Revisa los años de experiencia." })
        .optional(),
    ),
  };

  if (candidacyFields.full_name !== "hidden") {
    shape.full_name = fieldSchema(candidacyFields.full_name, 120, "Escribe tu nombre completo.");
  }
  if (candidacyFields.phone !== "hidden") {
    shape.phone = fieldSchema(candidacyFields.phone, 30, "Escribe un teléfono válido.");
  }
  if (candidacyFields.address !== "hidden") {
    shape.address = fieldSchema(candidacyFields.address, 200, "Escribe tu dirección.");
  }
  if (candidacyFields.cover_letter !== "hidden") {
    shape.cover_letter = fieldSchema(candidacyFields.cover_letter, 4000, "Escribe tu carta de motivación.");
  }

  return z.object(shape) as unknown as z.ZodType<ApplyFormValues>;
}
