import { z } from "zod";

export const CreateReportSchema = z.object({
  user_message: z
    .string()
    .trim()
    .min(3, { error: "Cuéntanos qué intentabas hacer." })
    .max(500, { error: "Máximo 500 caracteres." }),
  title: z.string().trim().max(200).optional(),
  code: z.string().trim().max(60).optional(),
  technical_detail: z.string().trim().max(2000).optional(),
  stack: z.string().trim().max(4000).optional(),
  url: z.string().trim().max(500).optional(),
  user_agent: z.string().trim().max(300).optional(),
});

export const PostMessageSchema = z.object({
  body: z.string().trim().min(1, { error: "Escribe un mensaje." }).max(2000, { error: "Mensaje muy largo." }),
});
