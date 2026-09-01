import type { Database } from "@/lib/supabase/database.types";

type ErrorSeverity = Database["public"]["Enums"]["error_severity"];
type ErrorStatus = Database["public"]["Enums"]["error_status"];

export const SEVERITY_LABEL: Record<ErrorSeverity, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  critica: "Crítica",
};

export const STATUS_LABEL: Record<ErrorStatus, string> = {
  nuevo: "Nuevo",
  en_revision: "En revisión",
  esperando_usuario: "Esperando al usuario",
  resuelto: "Resuelto",
  descartado: "Descartado",
};

export const STATUS_OPTIONS = Object.keys(STATUS_LABEL) as ErrorStatus[];
export const SEVERITY_OPTIONS = Object.keys(SEVERITY_LABEL) as ErrorSeverity[];
