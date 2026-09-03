/**
 * "Hoy" según la organización, no según el reloj de quien mira ni el del
 * servidor. Sin `server-only` a propósito: lo usan tanto un componente de
 * servidor (la agenda de Inicio) como uno de cliente (la lista de tareas),
 * y la cuenta se hace desde el instante absoluto, así que da el mismo
 * resultado en el navegador de un viajero y en Vercel (que corre en UTC).
 *
 * ponytail: UTC-6 fijo, no una zona horaria real por organización (no existe
 * esa columna en el esquema). Válido hoy porque los 4 países que opera esta
 * plataforma (Guatemala, El Salvador, Honduras, Nicaragua) están TODOS en
 * UTC-6 todo el año, sin horario de verano. Se rompe solo si la organización
 * opera fuera de Centroamérica; ahí hace falta una columna de zona horaria
 * real, no ajustar este número. Es la misma constante que usa
 * `lib/dashboard/org-clock.ts`, importada desde acá para no tener dos.
 */
export const ORG_UTC_OFFSET_HOURS = 6;

/** Fecha de hoy en la organización, como `YYYY-MM-DD` — comparable directo contra `candidate_tasks.due_date`, que es un `date` sin hora. */
export function getOrgToday(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - ORG_UTC_OFFSET_HOURS * 3_600_000);
  return shifted.toISOString().slice(0, 10);
}

/** Vencida = su fecha límite ya pasó. Una tarea que vence HOY no está vencida. */
export function isTaskOverdue(dueDate: string, now: Date = new Date()): boolean {
  return dueDate < getOrgToday(now);
}

/** Texto corto para mostrar la fecha límite, y si ya venció (para pintarla en rojo). */
export function dueDateLabel(dueDate: string, now: Date = new Date()): { text: string; overdue: boolean } {
  const today = getOrgToday(now);
  if (dueDate === today) return { text: "Vence hoy", overdue: false };
  // `${dueDate}T00:00:00` sin sufijo Z: se interpreta como medianoche local,
  // que es lo que hace que la fecha impresa coincida con la guardada. Con Z,
  // un navegador al oeste de UTC mostraría el día anterior.
  const formatted = new Date(`${dueDate}T00:00:00`).toLocaleDateString("es", { day: "numeric", month: "short" });
  return dueDate < today ? { text: `Venció el ${formatted}`, overdue: true } : { text: `Vence el ${formatted}`, overdue: false };
}
