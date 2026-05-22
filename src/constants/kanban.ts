import { Stage } from "@/types";

export interface StageConfig {
  id: Stage;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
}

export const STAGES: StageConfig[] = [
  {
    id: "en_analisis",
    label: "En Análisis",
    color: "text-blue-700",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    dotColor: "bg-blue-500",
  },
  {
    id: "en_proceso_aprobacion",
    label: "En Proceso de Aprobación",
    color: "text-amber-700",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    dotColor: "bg-amber-500",
  },
  {
    id: "finalizada",
    label: "Finalizada",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    dotColor: "bg-emerald-500",
  },
  {
    id: "cancelada_denegada",
    label: "Cancelada / Denegada",
    color: "text-red-700",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
    dotColor: "bg-red-500",
  },
];

export const STAGE_MAP = new Map<Stage, StageConfig>(
  STAGES.map((s) => [s.id, s])
);
