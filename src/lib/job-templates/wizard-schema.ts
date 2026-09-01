import { z } from "zod";
import { JobBaseSchema } from "@/lib/jobs/schema";
import { CompetencyDraftSchema } from "@/lib/job-templates/schema";
import { CANDIDACY_STATE_SCHEMA, CANDIDACY_FIELD_LABEL } from "@/lib/job-templates/candidacy-fields";
import type { CandidacyFieldKey } from "@/lib/job-templates/candidacy-fields";

// Paso 1 del wizard ("Detalles de la vacante"). A diferencia de
// JobTemplateSchema (Fase 15, la plantilla plana), este NO incluye
// pipeline_template_id — el pipeline de la plantilla ahora se arma en el
// paso "Etapas" (Fase 18, 4/7), no se elige de un catálogo aparte.
export const WizardStep1Schema = JobBaseSchema.pick({
  title: true,
  department_id: true,
  country: true,
  location: true,
  work_mode: true,
  employment_type: true,
  description: true,
  requirements: true,
}).extend({
  // "Puesto" en el wizard — mismo campo que ya existía como "Nombre de la
  // plantilla" (Fase 15), solo cambia la etiqueta visible.
  name: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres." }).max(80, { error: "Máximo 80 caracteres." }),
  // Llega como JSON serializado desde CompetencyListEditor — mismo patrón
  // que JobTemplateSchema.
  competencies: z.preprocess(
    (v) => (v === "" || v == null ? "[]" : v),
    z.string().transform((value, ctx) => {
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "Competencias inválidas." });
        return z.NEVER;
      }
    }),
  ).pipe(z.array(CompetencyDraftSchema).max(20, { error: "Máximo 20 competencias." })),
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
// que competencies/etapas, solo que acá hay dos niveles.
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
