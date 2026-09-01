import { z } from "zod";

/** La única pregunta del diálogo "Contarle al soporte". */
export const ReportErrorSchema = z.object({
  user_message: z
    .string()
    .trim()
    .min(5, { error: "Cuéntanos un poco más — al menos 5 caracteres." })
    .max(2000, { error: "Máximo 2000 caracteres." }),
  motivo: z.string().trim().max(60).optional(),
  titulo: z.string().trim().max(200).optional(),
  url: z.string().trim().max(500).optional(),
  user_agent: z.string().trim().max(300).optional(),
  technical_detail: z.string().trim().max(2000).optional(),
});
export type ReportErrorValues = z.infer<typeof ReportErrorSchema>;

export const ReplySchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, { error: "Escribe algo antes de responder." })
    .max(4000, { error: "Máximo 4000 caracteres." }),
});

export const ERROR_STATUS_LABEL = {
  nuevo: "Sin abrir",
  en_revision: "En revisión",
  esperando_usuario: "Esperando al usuario",
  resuelto: "Resuelto",
  descartado: "Descartado",
} as const;

export const ERROR_SEVERITY_LABEL = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
} as const;
