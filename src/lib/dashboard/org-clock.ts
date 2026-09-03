import "server-only";
// Una sola constante para toda la app — ver el porqué del UTC-6 fijo y sus
// límites en lib/org-today.ts, que también la usa desde el cliente.
import { ORG_UTC_OFFSET_HOURS } from "@/lib/org-today";

/** Rango [inicio, fin] del "día de hoy" de la organización, como instantes UTC reales — no el día del servidor (que en Vercel es UTC y puede ir 6 horas adelantado). */
export function getOrgDayRange(now: Date = new Date()): { start: Date; end: Date } {
  const shifted = new Date(now.getTime() - ORG_UTC_OFFSET_HOURS * 3_600_000);
  const localMidnightAsUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  const start = new Date(localMidnightAsUtc + ORG_UTC_OFFSET_HOURS * 3_600_000);
  const end = new Date(start.getTime() + 24 * 3_600_000 - 1);
  return { start, end };
}

/** Instante UTC real del "día 1 del mes" de la organización — mismo criterio que getOrgDayRange. */
export function getOrgMonthStart(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() - ORG_UTC_OFFSET_HOURS * 3_600_000);
  const localMonthStartAsUtc = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
  return new Date(localMonthStartAsUtc + ORG_UTC_OFFSET_HOURS * 3_600_000);
}
