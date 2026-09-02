import { z } from "zod";
import { optionalText, optionalUuid } from "@/lib/zod-helpers";

export const DepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "El nombre debe tener al menos 2 caracteres." })
    .max(120, { error: "Máximo 120 caracteres." }),
  country: optionalText(120),
  head_profile_id: optionalUuid("Persona inválida."),
});
