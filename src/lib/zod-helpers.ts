import { z } from "zod";

/** Un `<input>` vacío llega como `""`, no `undefined` — sin este preprocess, `.optional()` no lo reconoce como ausente y lo valida como string real. */
export function optionalText(max: number) {
  return z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(max, { error: `Máximo ${max} caracteres.` }).optional(),
  );
}

export function optionalUuid(message = "Id inválido.") {
  return z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.uuid({ error: message }).optional(),
  );
}
