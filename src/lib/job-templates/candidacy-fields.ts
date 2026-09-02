import { z } from "zod";

export const CANDIDACY_STATE_LABEL = {
  hidden: "No aparece",
  optional: "Opcional",
  required: "Obligatorio",
} as const;
export type CandidacyState = keyof typeof CANDIDACY_STATE_LABEL;

// Correo no está acá: siempre "required", fijo, nunca se ofrece como opción
// editable (ver WizardStep2Schema/updateTemplateStep2 — el servidor lo fuerza,
// nunca confía en un valor que mande el cliente para ese campo).
export const CANDIDACY_FIELD_LABEL = {
  full_name: "Nombre completo",
  phone: "Teléfono",
  address: "Dirección",
  resume: "Currículum",
  cover_letter: "Carta de motivación",
  additional_files: "Archivos adicionales",
} as const;
export type CandidacyFieldKey = keyof typeof CANDIDACY_FIELD_LABEL;

export type CandidacyFields = Record<CandidacyFieldKey, CandidacyState> & { email: "required" };

export const CANDIDACY_STATE_SCHEMA = z.enum(["hidden", "optional", "required"], { error: "Elige una opción." });

/**
 * `jobs.candidacy_fields`/`job_templates.candidacy_fields` llegan como
 * `Json` sin forma garantizada por el tipo de TypeScript — un simple
 * `as CandidacyFields` confía en que la columna siempre tiene exactamente
 * esta forma sin verificarlo. En la práctica solo la escriben
 * updateTemplateStep2/createJob (copia al crear), ambos con esta forma
 * exacta, pero portal público (`/api/postular`, sin autenticación) es el
 * peor lugar para confiar en un valor sin validar — cualquier fila
 * malformada (una migración futura, un valor legado) degrada la
 * candidatura pública en silencio en vez de fallar de forma explícita.
 * Cualquier clave ausente o inválida cae a "required" — el default más
 * seguro (pedir de más, nunca de menos).
 */
export function parseCandidacyFields(raw: unknown): CandidacyFields {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const result = {} as CandidacyFields;
  for (const key of Object.keys(CANDIDACY_FIELD_LABEL) as CandidacyFieldKey[]) {
    const parsed = CANDIDACY_STATE_SCHEMA.safeParse(source[key]);
    result[key] = parsed.success ? parsed.data : "required";
  }
  result.email = "required";
  return result;
}
