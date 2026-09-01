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
