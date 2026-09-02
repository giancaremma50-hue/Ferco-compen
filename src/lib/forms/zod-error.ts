import type { z } from "zod";

/**
 * Único punto que traduce un fallo de Zod a `{ error, field }` — `field` es
 * el primer segmento del path del primer issue, que coincide con el `name`
 * del input en todos los formularios del proyecto (se construyen con
 * `Object.fromEntries(formData)`, así que las claves del schema y los
 * `name` de los inputs son literalmente las mismas). Sin esto, cada acción
 * repetía `parsed.error.issues[0]?.message` y el campo que falló se perdía
 * — el usuario solo veía un toast genérico sin saber cuál corregir.
 */
export function zodFieldError(
  error: z.ZodError,
  fallback = "Revisa los datos del formulario.",
): { error: string; field?: string } {
  const issue = error.issues[0];
  const field = issue?.path[0];
  return { error: issue?.message ?? fallback, field: typeof field === "string" ? field : undefined };
}
