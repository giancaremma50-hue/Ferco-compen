import type { CandidateFilters } from "./get-candidates";

export { STAGE_TYPE_LABEL } from "@/lib/pipeline-templates/schema";

export const STATUS_LABEL: Record<NonNullable<CandidateFilters["status"]>, string> = {
  activa: "Activa",
  contratada: "Contratada",
  rechazada: "Rechazada",
  retirada: "Retirada",
};
