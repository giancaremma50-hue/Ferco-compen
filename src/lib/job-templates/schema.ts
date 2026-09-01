import { z } from "zod";
import { JobBaseSchema } from "@/lib/jobs/schema";
import { optionalUuid } from "@/lib/zod-helpers";

export const CompetencyDraftSchema = z.object({
  name: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres." }).max(80, { error: "Máximo 80 caracteres." }),
  weight: z
    .number({ error: "El peso debe ser un número." })
    .int({ error: "El peso debe ser un número entero." })
    .min(0, { error: "El peso no puede ser negativo." })
    .max(100, { error: "El peso máximo es 100." }),
});
export type CompetencyDraft = z.infer<typeof CompetencyDraftSchema>;

export const JobTemplateSchema = JobBaseSchema.pick({
  title: true,
  country: true,
  location: true,
  work_mode: true,
  employment_type: true,
  description: true,
  requirements: true,
}).extend({
  name: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres." }).max(80, { error: "Máximo 80 caracteres." }),
  pipeline_template_id: optionalUuid("Plantilla de pipeline inválida."),
  // Llega como JSON serializado desde el editor de competencias (input
  // oculto) — mismo patrón que `stages` en pipeline-templates/schema.ts.
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
