import { z } from "zod";

export const CompetencyDraftSchema = z.object({
  name: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres." }).max(80, { error: "Máximo 80 caracteres." }),
  weight: z
    .number({ error: "El peso debe ser un número." })
    .int({ error: "El peso debe ser un número entero." })
    .min(0, { error: "El peso no puede ser negativo." })
    .max(100, { error: "El peso máximo es 100." }),
});
export type CompetencyDraft = z.infer<typeof CompetencyDraftSchema>;
