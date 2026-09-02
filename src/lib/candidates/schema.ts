import { z } from "zod";
import { optionalText, optionalUuid } from "@/lib/zod-helpers";
import { StageSchema } from "@/lib/pipeline-templates/schema";

const optionalStageType = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  StageSchema.shape.type.optional(),
);

const optionalStatus = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.enum(["activa", "contratada", "rechazada", "retirada"]).optional(),
);

export const CandidateFiltersSchema = z.object({
  job_id: optionalUuid("Vacante inválida."),
  stage_type: optionalStageType,
  status: optionalStatus,
  q: optionalText(200),
});

export const SegmentSchema = CandidateFiltersSchema.extend({
  name: z.string().trim().min(2, { error: "El nombre debe tener al menos 2 caracteres." }).max(80, { error: "Máximo 80 caracteres." }),
});
