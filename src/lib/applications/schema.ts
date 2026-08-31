import { z } from "zod";

// El rango visible/calificable es 1-RATING_MAX; 0 es el valor especial que
// representa "sin calificar" (limpia el campo), no un mínimo calificable.
export const RATING_MAX = 5;

export const NoteSchema = z.object({
  body: z.string().trim().min(3, { error: "Escribe una nota." }).max(2000, { error: "La nota es muy larga." }),
  is_private: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const RejectSchema = z.object({
  rejection_reason_id: z.uuid({ error: "Elige un motivo de rechazo." }),
});
