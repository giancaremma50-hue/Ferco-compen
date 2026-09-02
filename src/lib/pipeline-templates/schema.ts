import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";

export type StageType = Database["public"]["Enums"]["job_stage_type"];

export const STAGE_TYPE_LABEL: Record<StageType, string> = {
  postulado: "Postulado",
  preseleccion: "Preselección",
  entrevista: "Entrevista",
  oferta: "Oferta",
  contratado: "Contratado",
  descartado: "Descartado",
};

export const StageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "El nombre de la etapa debe tener al menos 2 caracteres." })
    .max(80, { error: "Máximo 80 caracteres." }),
  type: z.enum(["postulado", "preseleccion", "entrevista", "oferta", "contratado", "descartado"], {
    error: "Elige un tipo de etapa.",
  }),
});

export const PipelineTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "El nombre de la plantilla debe tener al menos 2 caracteres." })
    .max(120, { error: "Máximo 120 caracteres." }),
  // Llega como JSON serializado desde el editor de etapas (input oculto) —
  // ver src/components/configuracion/pipeline-stages-editor.tsx.
  stages: z
    .string()
    .transform((value, ctx) => {
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "Etapas inválidas." });
        return z.NEVER;
      }
    })
    .pipe(z.array(StageSchema).min(1, { error: "Agrega al menos una etapa." })),
});
