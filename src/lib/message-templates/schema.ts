import { z } from "zod";

export const MessageTemplateSchema = z.object({
  name: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres." }).max(80, { error: "Máximo 80 caracteres." }),
  subject: z
    .string()
    .trim()
    .min(2, { error: "El asunto debe tener al menos 2 caracteres." })
    .max(160, { error: "Máximo 160 caracteres." }),
  body: z
    .string()
    .trim()
    .min(2, { error: "El cuerpo debe tener al menos 2 caracteres." })
    .max(4000, { error: "Máximo 4000 caracteres." }),
});
