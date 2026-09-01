import { z } from "zod";
import { optionalText } from "@/lib/zod-helpers";

export const InterviewSchema = z.object({
  interviewer_id: z.uuid({ error: "Elige quién entrevista." }),
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
