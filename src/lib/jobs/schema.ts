import { z } from "zod";

export const JobStatusSchema = z.enum([
  "borrador",
  "pendiente_aprobacion",
  "abierta",
  "pausada",
  "cerrada",
  "cancelada",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const WORK_MODE_LABEL = {
  presencial: "Presencial",
  remoto: "Remoto",
  hibrido: "Híbrido",
} as const;
export type WorkMode = keyof typeof WORK_MODE_LABEL;

export const EMPLOYMENT_TYPE_LABEL = {
  indefinido: "Indefinido",
  temporal: "Temporal",
  por_obra: "Por obra",
  pasantia: "Pasantía",
} as const;
export type EmploymentType = keyof typeof EMPLOYMENT_TYPE_LABEL;

const optionalUuid = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.uuid({ error: "Departamento inválido." }).optional(),
);

const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().positive({ error: "Debe ser un número positivo." }).optional(),
);

export const JobFormSchema = z
  .object({
    title: z.string().trim().min(4, { error: "El título debe tener al menos 4 caracteres." }).max(120),
    department_id: optionalUuid,
    country: z.string().trim().min(2, { error: "Indica el país." }).max(60),
    location: z.string().trim().min(2, { error: "Indica la ubicación." }).max(120),
    work_mode: z.enum(["presencial", "remoto", "hibrido"], { error: "Elige una modalidad." }),
    employment_type: z.enum(["indefinido", "temporal", "por_obra", "pasantia"], {
      error: "Elige un tipo de contrato.",
    }),
    description: z.string().trim().min(20, { error: "Describe la vacante con al menos 20 caracteres." }),
    requirements: z.string().trim().min(10, { error: "Describe los requisitos con al menos 10 caracteres." }),
    salary_min: optionalNumber,
    salary_max: optionalNumber,
    headcount: z.preprocess(
      (v) => (v === "" || v == null ? 1 : Number(v)),
      z
        .number()
        .int({ error: "El número de plazas debe ser un número entero." })
        .positive({ error: "El número de plazas debe ser al menos 1." }),
    ),
    is_public: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  })
  .refine((data) => data.salary_min == null || data.salary_max == null || data.salary_min <= data.salary_max, {
    error: "El salario mínimo no puede ser mayor que el máximo.",
    path: ["salary_max"],
  });
export type JobFormValues = z.infer<typeof JobFormSchema>;
