import { z } from "zod";

export const RejectionReasonSchema = z.object({
  label: z
    .string()
    .trim()
    .min(2, { error: "El motivo debe tener al menos 2 caracteres." })
    .max(160, { error: "Máximo 160 caracteres." }),
});
