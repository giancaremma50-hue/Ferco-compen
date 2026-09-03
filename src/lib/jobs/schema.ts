import { z } from "zod";
import { COUNTRIES } from "@/lib/geo/countries";
import { optionalUuid as sharedOptionalUuid } from "@/lib/zod-helpers";

export const JobStatusSchema = z.enum([
  "borrador",
  "pendiente_aprobacion",
  "aceptada",
  "abierta",
  "pausada",
  "cerrada",
  "cancelada",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobVisibilitySchema = z.enum(["publica", "interna", "confidencial"]);
export type JobVisibility = z.infer<typeof JobVisibilitySchema>;

export const VISIBILITY_LABEL: Record<JobVisibility, string> = {
  publica: "Pública — portal de empleos y empleados",
  interna: "Interna — solo empleados, no sale al portal",
  confidencial: "Confidencial — solo el equipo de esta vacante",
};

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

// Sin `.refine()` todavía — separado para que otros schemas (ej. plantillas
// de vacante) puedan reusar estos mismos campos con `.pick()`, algo que Zod
// v4 no permite sobre un objeto que ya tiene un refinamiento encima.
export const JobBaseSchema = z.object({
  title: z.string().trim().min(4, { error: "El título debe tener al menos 4 caracteres." }).max(120),
  department_id: optionalUuid,
  country: z.enum(COUNTRIES, { error: "Elige un país." }),
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
  visibility: JobVisibilitySchema,
});

export const JobFormSchema = JobBaseSchema.refine(
  (data) => data.salary_min == null || data.salary_max == null || data.salary_min <= data.salary_max,
  { error: "El salario mínimo no puede ser mayor que el máximo.", path: ["salary_max"] },
);
export type JobFormValues = z.infer<typeof JobFormSchema>;

export const VACANCY_TYPE_LABEL = {
  nueva_posicion: "Nueva posición",
  reemplazo: "Reemplazo",
  crecimiento: "Crecimiento / expansión",
} as const;
export type VacancyType = keyof typeof VACANCY_TYPE_LABEL;

const idListField = (max: number, message: string) =>
  z
    .preprocess(
      (v) => (v === "" || v == null ? "[]" : v),
      z.string().transform((value, ctx) => {
        try {
          return JSON.parse(value);
        } catch {
          ctx.addIssue({ code: "custom", message: "Selección inválida." });
          return z.NEVER;
        }
      }),
    )
    .pipe(z.array(z.uuid()).max(max, { error: message }));

// Creación de vacante desde plantilla (Fase 18, revisada tras leer el manual
// de uso) — a diferencia de JobFormSchema (edición libre, Fase 4), acá solo
// viven los campos que quedan editables al SOLICITAR: título, descripción,
// requisitos, candidatura, preguntas y etapas se copian server-side desde la
// plantilla elegida, nunca del cliente. País/ubicación/modalidad/tipo de
// contrato SÍ viven acá, no en la plantilla — un mismo puesto puede abrirse
// en más de un país o modalidad sin duplicar la plantilla.
//
// `owner_id` (reclutador encargado) ya no se elige acá — lo asigna RH al
// aceptar la solicitud (acceptJobRequest en actions.ts). `requester_id`/
// `extra_admin_ids` solo tienen efecto cuando quien crea es admin+ (elegir
// en nombre de qué gestor se solicita, y agregar más admins al equipo) —
// createJob los ignora si el actor no es admin+, revalidando el ROL REAL del
// actor autenticado, nunca lo que el cliente diga ser.
export const CreateJobFromTemplateSchema = z
  .object({
    template_id: z.uuid({ error: "Elige una plantilla." }),
    country: z.enum(COUNTRIES, { error: "Elige un país." }),
    location: z.string().trim().min(2, { error: "Indica la ubicación." }).max(120),
    work_mode: z.enum(["presencial", "remoto", "hibrido"], { error: "Elige una modalidad." }),
    employment_type: z.enum(["indefinido", "temporal", "por_obra", "pasantia"], {
      error: "Elige un tipo de contrato.",
    }),
    salary_min: optionalNumber,
    salary_max: optionalNumber,
    headcount: z.preprocess(
      (v) => (v === "" || v == null ? 1 : Number(v)),
      z
        .number()
        .int({ error: "El número de plazas debe ser un número entero." })
        .positive({ error: "El número de plazas debe ser al menos 1." }),
    ),
    vacancy_type: z.enum(["nueva_posicion", "reemplazo", "crecimiento"], { error: "Elige el tipo de vacante." }),
    employment_reason_id: sharedOptionalUuid("Ese motivo de vacante no es válido."),
    requester_id: sharedOptionalUuid("Esa persona no es válida."),
    // Llega como JSON serializado desde CollaboratorsPicker — un <select
    // multiple> perdería todas las opciones salvo la última al pasar por
    // Object.fromEntries(formData), que no soporta claves repetidas.
    collaborator_ids: idListField(30, "Máximo 30 colaboradores adicionales."),
    extra_admin_ids: idListField(10, "Máximo 10 admins adicionales."),
  })
  .refine((data) => data.salary_min == null || data.salary_max == null || data.salary_min <= data.salary_max, {
    error: "El salario mínimo no puede ser mayor que el máximo.",
    path: ["salary_max"],
  });
export type CreateJobFromTemplateValues = z.infer<typeof CreateJobFromTemplateSchema>;
