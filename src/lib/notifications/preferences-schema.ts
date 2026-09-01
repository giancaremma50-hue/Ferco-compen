import type { Database } from "@/lib/supabase/database.types";

type NotificationType = Database["public"]["Enums"]["notification_type"];

// mencion_nota queda fuera: Fase 5 nunca construyó un selector de @mención
// en NoteForm, así que ese tipo nunca se dispara todavía — no tiene sentido
// mostrar una preferencia para un evento que no ocurre. respuesta_reporte_error
// ya se dispara desde Fase 7 (Centro de errores) — incluido.
export const PREFERENCE_TYPES: NotificationType[] = [
  "nueva_postulacion",
  "cambio_etapa",
  "vacante_pendiente_aprobacion",
  "movimiento_referido",
  "respuesta_reporte_error",
];

// respuesta_reporte_error cubre las dos direcciones de un mismo hilo: para
// quien reportó, una respuesta del soporte; para un super admin, también un
// reporte nuevo que llegó a revisar (report-actions.ts reutiliza el mismo
// tipo en ambos sentidos). El label tiene que ser honesto sobre ese alcance
// — "Respuestas del soporte" haría pensar a un super admin que apagarlo solo
// silencia respuestas a SUS reportes, cuando también apaga el aviso de
// reportes nuevos por triar.
export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  nueva_postulacion: "Nueva postulación en tus vacantes",
  cambio_etapa: "Cambios de etapa en tus vacantes",
  mencion_nota: "Menciones en notas",
  vacante_pendiente_aprobacion: "Vacantes pendientes de aprobación",
  movimiento_referido: "Movimientos de tus referidos",
  respuesta_reporte_error: "Actividad en reportes de error",
};
