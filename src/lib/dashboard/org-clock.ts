import "server-only";

// ponytail: UTC-6 fijo, no una zona horaria real por organización (no existe
// esa columna en el esquema — mismo límite ya documentado en
// emails/entrevista-programada.tsx). Válido hoy porque los 4 países que
// opera esta plataforma (Guatemala, El Salvador, Honduras, Nicaragua, ver
// src/lib/geo/countries.ts) están TODOS en UTC-6 todo el año, sin horario de
// verano — no es una suposición, es un hecho geográfico estable. Se rompe
// solo si la organización opera en un país fuera de Centroamérica; en ese
// caso hace falta una columna de zona horaria real, no ajustar este número.
const ORG_UTC_OFFSET_HOURS = 6;

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
