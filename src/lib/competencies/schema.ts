import { z } from "zod";

export const SCORE_MAX = 5;

export const CompetencySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { error: "El nombre debe tener al menos 2 caracteres." })
    .max(80, { error: "Máximo 80 caracteres." }),
  // { error } en el propio z.number() cubre el caso NaN (ej. un valor no
  // numérico posteado directo a la Server Action, sin pasar por el
  // <input type="number">) — sin esto, ese caso muestra el mensaje en
  // inglés de Zod ("Invalid input: expected number"), ni .int() ni .min()
  // ni .max() lo cubren porque el chequeo de tipo corre antes que ellos.
  weight: z.preprocess(
    (v) => (v === "" || v == null ? 0 : Number(v)),
    z
      .number({ error: "El peso debe ser un número." })
      .int({ error: "El peso debe ser un número entero." })
      .min(0, { error: "El peso no puede ser negativo." })
      .max(100, { error: "El peso máximo es 100." }),
  ),
});

export const ScoreSchema = z.object({
  score: z.preprocess(
    (v) => Number(v),
    z
      .number({ error: "La calificación debe ser un número." })
      .int({ error: "La calificación debe ser un número entero." })
      .min(1, { error: "Mínimo 1." })
      .max(SCORE_MAX, { error: `Máximo ${SCORE_MAX}.` }),
  ),
  comment: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(500, { error: "Máximo 500 caracteres." }).optional(),
  ),
});
