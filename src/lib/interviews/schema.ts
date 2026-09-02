import { z } from "zod";
import { optionalText } from "@/lib/zod-helpers";

export const InterviewSchema = z.object({
  // Llega como JSON serializado (un array de ids) desde el wizard de
  // destinatarios — mismo patrón que `stages`/`questions` en otros
  // editores de lista de este proyecto.
  attendee_ids: z.preprocess(
    (v) => (v === "" || v == null ? "[]" : v),
    z.string().transform((value, ctx) => {
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "Destinatarios inválidos." });
        return z.NEVER;
      }
    }),
  ).pipe(z.array(z.uuid()).min(1, { error: "Elige al menos un destinatario." })),
  scheduled_at: z.iso.datetime({ error: "Elige fecha y hora.", offset: true }),
  duration_minutes: z.preprocess(
    (v) => (v === "" || v == null ? 30 : Number(v)),
    z
      .number({ error: "Duración inválida." })
      .int({ error: "Duración inválida." })
      .min(15, { error: "Mínimo 15 minutos." })
      .max(480, { error: "Máximo 8 horas." }),
  ),
  location: optionalText(200),
  notes: optionalText(1000),
});

export const InterviewStatusSchema = z.enum(["completada", "cancelada"], { error: "Estado inválido." });
