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
