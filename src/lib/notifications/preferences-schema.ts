import type { Database } from "@/lib/supabase/database.types";

type NotificationType = Database["public"]["Enums"]["notification_type"];

// mencion_nota queda fuera: Fase 5 nunca construyó un selector de @mención
// en NoteForm, así que ese tipo nunca se dispara todavía — no tiene sentido
// mostrar una preferencia para un evento que no ocurre. respuesta_reporte_error
// es de Fase 7 (Centro de errores).
export const PREFERENCE_TYPES: NotificationType[] = [
  "nueva_postulacion",
  "cambio_etapa",
  "vacante_pendiente_aprobacion",
  "movimiento_referido",
];

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  nueva_postulacion: "Nueva postulación en tus vacantes",
  cambio_etapa: "Cambios de etapa en tus vacantes",
  mencion_nota: "Menciones en notas",
  vacante_pendiente_aprobacion: "Vacantes pendientes de aprobación",
  movimiento_referido: "Movimientos de tus referidos",
  respuesta_reporte_error: "Respuestas del soporte",
};
