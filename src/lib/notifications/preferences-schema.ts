import type { Database } from "@/lib/supabase/database.types";

type NotificationType = Database["public"]["Enums"]["notification_type"];

// mencion_nota queda fuera: Fase 5 nunca construyó un selector de @mención
// en NoteForm, así que ese tipo nunca se dispara todavía — no tiene sentido
// mostrar una preferencia para un evento que no ocurre.
export const PREFERENCE_TYPES: NotificationType[] = [
  "nueva_postulacion",
  "cambio_etapa",
  "vacante_pendiente_aprobacion",
  "movimiento_referido",
  "respuesta_reporte_error",
];

// respuesta_reporte_error se reutiliza en las dos direcciones (Fase 7): al
// reportante cuando soporte responde, y a los super admin cuando entra un
// reporte nuevo o el reportante escribe de vuelta — no existe un segundo
// valor de enum para "reporte nuevo" y no vale la pena una migración solo
// por el nombre. La etiqueta queda neutral a propósito.
export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  nueva_postulacion: "Nueva postulación en tus vacantes",
  cambio_etapa: "Cambios de etapa en tus vacantes",
  mencion_nota: "Menciones en notas",
  vacante_pendiente_aprobacion: "Vacantes pendientes de aprobación",
  movimiento_referido: "Movimientos de tus referidos",
  respuesta_reporte_error: "Actividad en reportes de soporte",
};
