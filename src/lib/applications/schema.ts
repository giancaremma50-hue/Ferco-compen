import { z } from "zod";

export const RATING_MIN = 1;
export const RATING_MAX = 5;

export const NoteSchema = z.object({
  body: z.string().trim().min(3, { error: "Escribe una nota." }).max(2000, { error: "La nota es muy larga." }),
  is_private: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const RejectSchema = z.object({
  rejection_reason_id: z.uuid({ error: "Elige un motivo de rechazo." }),
});
