import { z } from "zod";

const optionalText = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().trim().max(120, { error: "Máximo 120 caracteres." }).optional(),
);
const optionalUuid = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.uuid({ error: "Persona inválida." }).optional(),
);

export const DepartmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "El nombre debe tener al menos 2 caracteres." })
    .max(120, { error: "Máximo 120 caracteres." }),
  country: optionalText,
  head_profile_id: optionalUuid,
});
