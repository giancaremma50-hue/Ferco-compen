import { z } from "zod";
import { JobBaseSchema } from "@/lib/jobs/schema";
import { CANDIDACY_STATE_SCHEMA, CANDIDACY_FIELD_LABEL } from "@/lib/job-templates/candidacy-fields";
import type { CandidacyFieldKey } from "@/lib/job-templates/candidacy-fields";

// Paso 1 del wizard ("Detalles del puesto"). No incluye pipeline_template_id
// — el pipeline de la plantilla se arma en el paso "Etapas" (Fase 18, 4/7),
// no se elige de un catálogo aparte. País/ubicación/modalidad/tipo de
// contrato NO viven acá (post-manual de uso): un puesto es general, la
// SOLICITUD de vacante es la que lo vuelve específico a un país/modalidad
// concreto — ver CreateJobFromTemplateSchema en lib/jobs/schema.ts.
export const WizardStep1Schema = JobBaseSchema.pick({
  title: true,
  department_id: true,
  description: true,
  requirements: true,
}).extend({
  // "Puesto" en el wizard — mismo campo que ya existía como "Nombre de la
  // plantilla" (Fase 15), solo cambia la etiqueta visible.
  name: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres." }).max(80, { error: "Máximo 80 caracteres." }),
});
export type WizardStep1Values = z.infer<typeof WizardStep1Schema>;

// Paso 2 ("Candidatura"). `email` no es un campo de este schema a propósito
// — es fijo "Obligatorio" y el servidor lo fuerza, nunca lee un valor de
// email que mande el cliente (mismo principio "el cliente no es fuente de
// verdad" de siempre en este proyecto).
const candidacyFieldsShape = Object.fromEntries(
  (Object.keys(CANDIDACY_FIELD_LABEL) as CandidacyFieldKey[]).map((key) => [key, CANDIDACY_STATE_SCHEMA]),
) as Record<CandidacyFieldKey, typeof CANDIDACY_STATE_SCHEMA>;

export const WizardStep2Schema = z.object(candidacyFieldsShape);
export type WizardStep2Values = z.infer<typeof WizardStep2Schema>;

// Paso 3 ("Preguntas"). Las opciones de opción múltiple llegan anidadas
// dentro de cada pregunta en el mismo JSON — mismo patrón "reemplazar todo"
// que las preguntas/etapas, solo que acá hay dos niveles.
const QuestionOptionDraftSchema = z.object({
  label: z.string().trim().min(1, { error: "Escribe el texto de la opción." }).max(200, { error: "Máximo 200 caracteres." }),
  is_expected: z.boolean(),
});
export type QuestionOptionDraft = z.infer<typeof QuestionOptionDraftSchema>;

const QuestionDraftSchema = z
  .object({
    prompt: z.string().trim().min(3, { error: "Escribe la pregunta." }).max(300, { error: "Máximo 300 caracteres." }),
    type: z.enum(["open", "multiple_choice"], { error: "Elige un tipo de pregunta." }),
    options: z.array(QuestionOptionDraftSchema).max(10, { error: "Máximo 10 opciones por pregunta." }),
  })
  .refine((q) => q.type !== "multiple_choice" || q.options.length >= 2, {
    error: "Una pregunta de opción múltiple necesita al menos 2 opciones.",
    path: ["options"],
  });
export type QuestionDraft = z.infer<typeof QuestionDraftSchema>;

export const WizardStep3Schema = z.object({
  questions: z.preprocess(
    (v) => (v === "" || v == null ? "[]" : v),
    z.string().transform((value, ctx) => {
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "Preguntas inválidas." });
        return z.NEVER;
      }
    }),
  ).pipe(z.array(QuestionDraftSchema).max(20, { error: "Máximo 20 preguntas." })),
});
export type WizardStep3Values = z.infer<typeof WizardStep3Schema>;

// Paso 4 ("Etapas"). Solo las etapas del MEDIO — "Bandeja de entrada"
// (postulado) y "Contratado"/"Descartado" son fijas, el servidor las arma
// siempre igual (nunca confía en que el cliente mande esos 3 textos/tipos).
// Los tres tipos reservados para esas etapas fijas no son opciones válidas
// acá — una etapa intermedia con type "contratado" sería confusa (¿es la
// fija, o una copia?).
const TemplateStageDraftSchema = z.object({
  title: z.string().trim().min(2, { error: "El nombre de la etapa debe tener al menos 2 caracteres." }).max(80, { error: "Máximo 80 caracteres." }),
  type: z.enum(["preseleccion", "entrevista", "oferta"], { error: "Elige un tipo de etapa." }),
});
export type TemplateStageDraft = z.infer<typeof TemplateStageDraftSchema>;

export const WizardStep4Schema = z.object({
  stages: z.preprocess(
    (v) => (v === "" || v == null ? "[]" : v),
    z.string().transform((value, ctx) => {
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "Etapas inválidas." });
        return z.NEVER;
      }
    }),
  ).pipe(z.array(TemplateStageDraftSchema).max(15, { error: "Máximo 15 etapas intermedias." })),
  // "Guardar este set como reutilizable" — nace desde el propio wizard, ya
  // que se quitó la pestaña Pipelines dedicada (ver napkin.md). Vacío/ausente
  // = no guardar nada nuevo, solo las etapas de esta plantilla.
  reusable_set_name: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().min(2, { error: "El nombre del set debe tener al menos 2 caracteres." }).max(120, { error: "Máximo 120 caracteres." }).optional(),
  ),
});
export type WizardStep4Values = z.infer<typeof WizardStep4Schema>;

// Paso 5 ("Permisos y usos") — un solo switch.
export const WizardStep5Schema = z.object({
  is_confidential: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});
export type WizardStep5Values = z.infer<typeof WizardStep5Schema>;
