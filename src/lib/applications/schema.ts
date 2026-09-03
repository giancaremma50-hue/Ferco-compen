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

const optionalAssignee = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.uuid({ error: "Persona inválida." }).optional(),
);

export const TaskSchema = z.object({
  description: z
    .string()
    .trim()
    .min(3, { error: "Describe la tarea." })
    .max(300, { error: "Máximo 300 caracteres." }),
  assigned_to: optionalAssignee,
  // Opcional a propósito: una tarea sin fecha sigue siendo válida (se ordena
  // al final). La agenda de Inicio la necesita para poder decir "vencida" —
  // antes no existía la columna y el copy tenía que evitar esa palabra.
  due_date: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.iso.date({ error: "Fecha inválida." }).optional(),
  ),
});

export const SendMessageSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(2, { error: "El asunto debe tener al menos 2 caracteres." })
    .max(160, { error: "Máximo 160 caracteres." }),
  body: z
    .string()
    .trim()
    .min(2, { error: "Escribe el mensaje." })
    .max(4000, { error: "Máximo 4000 caracteres." }),
});
