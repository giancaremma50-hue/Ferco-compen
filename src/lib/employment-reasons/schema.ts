import { z } from "zod";

export const EmploymentReasonSchema = z.object({
  label: z.string().trim().min(2, { error: "El motivo debe tener al menos 2 caracteres." }).max(80, { error: "Máximo 80 caracteres." }),
});
