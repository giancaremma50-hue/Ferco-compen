# Fase 4 — Vacantes, portal público y postulación — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD de vacantes con flujo de aprobación (gestor solicita → admin aprueba y publica), portal público de empleos con formulario de postulación (CV a Storage vía Route Handler con service role, deduplicación de candidatos), y referidos internos.

**Architecture:** Server Components + Server Actions para todo lo interno (respeta RLS vía `src/lib/supabase/server.ts`); un único Route Handler público (`/api/postular`) con el cliente admin (service role) para la escritura no autenticada, con validación Zod y rate limit por IP. El esquema de base de datos (jobs, job_stages, job_collaborators, pipeline_templates, candidates, applications, rejection_reasons) **ya existe desde la Fase 2** con RLS verificado por rol — esta fase es puramente capa de aplicación.

**Tech Stack:** Next.js 16 App Router, Server Actions, Zod v4, react-hook-form, Supabase (Postgres + Storage + `@supabase/ssr`), Tailwind v4, framer-motion.

**Spec:** `/root/.claude/plans/quiero-que-usemos-este-ethereal-acorn.md` (secciones "Fase 4", "Esquema de base de datos", "Sistema de diseño").

**Verificación de este proyecto (no hay test runner — no hay jest/vitest instalado, y no hay que introducir uno para esta fase):** cada tarea se cierra con `npm run typecheck && npm run lint && npm run build` limpios. Los caminos sensibles a RLS o triggers se verifican con SQL directo vía el MCP de Supabase (`execute_sql`), simulando el JWT del rol relevante, igual que se hizo en la Fase 2 y 3 — documentado en `.claude/napkin.md`. Al cerrar toda la fase corre `/code-review --high` hasta converger, luego se actualiza `.claude/napkin.md`/`docs/database.md` si aplica y se hace un solo push de cierre de fase (regla de AGENTS.md: "toda fase ya terminada y verificada se empuja directo al repositorio").

## Global Constraints

- Todo el texto de interfaz en español, cero inglés.
- Todo botón que muta datos usa `<ActionButton>` (`src/components/ui/action-button.tsx`) — nunca un `<button type="submit">` crudo para una mutación.
- Toda mutación exitosa llama `notifySuccess("<mensaje concreto>")` — nunca "Éxito" ni "Listo".
- Todo borrado usa `<DeleteButton>` (rojo, ícono `X`, abre `<ConfirmDialog>` nombrando el elemento) — nunca un clic único.
- Skeletons (`src/components/ui/skeleton.tsx`) en cada `loading.tsx` nuevo; estados vacíos con una acción, nunca texto muerto.
- Zod en cada Server Action y cada Route Handler — el cliente nunca es fuente de verdad.
- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en `src/lib/supabase/admin.ts`, nunca en un client component, nunca con prefijo `NEXT_PUBLIC_`.
- Estética "editorial sobrio": fondo `#FAF9F7`, elevación con borde de 1px (nunca sombra difusa), un solo acento (usa `var(--accent)`, configurable — no un hex fijo), serif (`font-serif`) en títulos de página y cifras, `font-variant-numeric: tabular-nums` en toda métrica/tabla.
- CVs solo en el bucket privado `cvs-privado`, nunca con URL pública — para verlos en la app (Fase 5) se usará `createSignedUrl`; esta fase solo los sube.
- Toda ruta o Server Action nueva bajo `(app)/` pasa por `requireProfile()`/`requireAdminOrAbove()` de `src/lib/auth/dal.ts` según corresponda — nunca confiar solo en `proxy.ts` (chequeo optimista).

---

## Mapa de archivos

**Dominio de vacantes (interno):**
- `src/lib/jobs/schema.ts` — Zod schemas compartidos (`JobFormSchema`, `JobStatusSchema`).
- `src/lib/jobs/get-jobs.ts` — `getJobsForViewer(profile)`, `getJobById(id, profile)` — queries de lectura, ya filtradas por RLS pero con `select` explícito por rol para evitar pedir columnas de más.
- `src/lib/jobs/actions.ts` — Server Actions: `createJob`, `updateJob`, `submitForApproval`, `approveAndPublish`, `rejectApproval`, `pauseJob`, `reopenJob`, `closeJob`, `cancelJob`, `deleteJobDraft`.
- `src/lib/jobs/materialize-stages.ts` — `materializeJobStages(supabase, jobId, organizationId)`: copia la plantilla activa de `pipeline_template_stages` a `job_stages`.

**Vistas internas (`src/app/(app)/vacantes/`):**
- `page.tsx` — listado filtrado por rol.
- `loading.tsx` — skeleton del listado.
- `nueva/page.tsx` — formulario de alta (gestor solicita / admin crea directo).
- `[id]/page.tsx` — detalle: datos, estado, acciones según rol (aprobar, publicar, pausar, cerrar, cancelar, referir candidato).
- `[id]/loading.tsx`.

**Componentes:**
- `src/components/vacantes/job-form.tsx` — formulario compartido alta/edición.
- `src/components/vacantes/job-status-badge.tsx` — badge de estado con color semántico.
- `src/components/vacantes/job-card.tsx` — tarjeta de listado interno.
- `src/components/vacantes/approval-actions.tsx` — botones de aprobar/rechazar/publicar/pausar/cerrar/cancelar, cada uno `<ActionButton>` o `<DeleteButton>` según corresponda.
- `src/components/vacantes/refer-candidate-dialog.tsx` — diálogo de referido interno.

**Portal público (`src/app/(public)/empleos/`):**
- `layout.tsx` — layout propio sin `AppHeader`/`FloatingNav` (son de `(app)`), con su propia cabecera simple usando `getOrganization()`.
- `page.tsx` — listado público (solo `status = 'abierta'` y `is_public = true`).
- `loading.tsx`.
- `[slug]/page.tsx` — detalle + `<ApplicationForm>`.
- `[slug]/loading.tsx`.

**Componentes públicos:**
- `src/components/empleos/job-public-card.tsx`.
- `src/components/empleos/application-form.tsx` — client component, `useActionState` contra una Server Action que llama internamente al mismo Route Handler... **no**: el portal público debe entrar por Route Handler, no Server Action con `createClient()` (que usa el rol `anon`, prohibido para escritura pública por AGENTS.md). Así que `ApplicationForm` hace `fetch("/api/postular", { method: "POST", body: formData })` directo, no `useActionState`. Ver Tarea 8 para el patrón exacto de estado de carga sin `useActionState`.

**Route Handler público:**
- `src/app/api/postular/route.ts` — `POST`, `createAdminClient()`, Zod, rate limit, verifica `status='abierta'`, sube CV a `cvs-privado`, dedupe de candidato, crea `applications` + `application_events` (`stage_changed` inicial).
- `src/lib/rate-limit.ts` — limitador simple en memoria por IP (ver Tarea 7 para por qué en memoria es aceptable aquí y sus límites).

**Referidos internos:**
- Reutiliza `src/app/api/postular/route.ts` NO — un colaborador autenticado debe crear la referencia con su propia sesión (para que `candidates.referred_by` quede con su `auth.uid()` real, no un valor de formulario). Esto va en `src/lib/jobs/actions.ts` como `referCandidate(jobId, formData)`, usando `createClient()` (RLS respetada, rol real del colaborador).

**Nav:**
- `src/components/layout/floating-nav.tsx` — agregar ítem "Vacantes" (`/vacantes`, ícono `Briefcase` de lucide-react) para todos los roles, antes de "Ajustes".

---

## Interfaces clave (para que las tareas no diverjan en nombres)

```ts
// src/lib/jobs/schema.ts
export const JobStatusSchema = z.enum([
  "borrador", "pendiente_aprobacion", "abierta", "pausada", "cerrada", "cancelada",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobFormSchema = z.object({
  title: z.string().trim().min(4).max(120),
  department_id: z.uuid(),
  country: z.string().trim().min(2).max(60),
  location: z.string().trim().min(2).max(120),
  modality: z.enum(["presencial", "remoto", "hibrido"]),
  contract_type: z.enum(["indefinido", "temporal", "por_obra", "pasantia"]),
  description: z.string().trim().min(20),
  requirements: z.string().trim().min(10),
  salary_min: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().positive().optional()),
  salary_max: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().positive().optional()),
  openings: z.preprocess((v) => (v === "" || v == null ? 1 : Number(v)), z.number().int().positive()),
  is_public: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});
export type JobFormValues = z.infer<typeof JobFormSchema>;
```

```ts
// src/lib/jobs/get-jobs.ts
import type { Profile } from "@/lib/auth/dal"; // tipo ya existente, reexportar si hace falta
export async function getJobsForViewer(profile: Profile): Promise<JobListItem[]>;
export async function getJobById(id: string): Promise<JobDetail | null>;
export type JobListItem = { id: string; code: string; title: string; status: JobStatus; country: string; openings: number; published_at: string | null };
export type JobDetail = JobListItem & { description: string; requirements: string; department_id: string; is_public: boolean; slug: string | null; requested_by: string; owner_id: string | null };
```

```ts
// src/lib/jobs/actions.ts
export type JobActionResult = { error?: string; success?: string };
export async function createJob(_prev: JobActionResult | undefined, formData: FormData): Promise<JobActionResult>;
export async function updateJob(jobId: string, _prev: JobActionResult | undefined, formData: FormData): Promise<JobActionResult>;
export async function submitForApproval(jobId: string): Promise<JobActionResult>;
export async function approveAndPublish(jobId: string): Promise<JobActionResult>;
export async function rejectApproval(jobId: string, reason: string): Promise<JobActionResult>;
export async function pauseJob(jobId: string): Promise<JobActionResult>;
export async function reopenJob(jobId: string): Promise<JobActionResult>;
export async function closeJob(jobId: string): Promise<JobActionResult>;
export async function cancelJob(jobId: string): Promise<JobActionResult>;
export async function deleteJobDraft(jobId: string): Promise<JobActionResult>;
export async function referCandidate(jobId: string, _prev: JobActionResult | undefined, formData: FormData): Promise<JobActionResult>;
```

```ts
// src/lib/jobs/materialize-stages.ts
import type { SupabaseClient } from "@supabase/supabase-js";
export async function materializeJobStages(
  supabase: SupabaseClient,
  jobId: string,
  organizationId: string,
): Promise<{ error?: string }>;
```

```ts
// src/app/api/postular/route.ts
export async function POST(request: NextRequest): Promise<NextResponse>;
// Respuesta: { success: true } con 201, o { error: string } con 400/404/409/429.
```

```ts
// src/lib/rate-limit.ts
export function checkRateLimit(key: string, opts?: { max?: number; windowMs?: number }): boolean; // true = permitido
```

---

## Tarea 1 — Esquema de vacantes: leer y confirmar contra la base real

No se crea código todavía. Antes de escribir Zod/queries contra columnas que solo existen en la memoria del plan original, hay que confirmar los nombres reales de columna en la base (la Fase 2 pudo haber ajustado algo al aplicar las migraciones).

**Archivos:** ninguno (solo lectura vía MCP).

- [ ] **Paso 1: Listar columnas reales de `jobs`, `job_stages`, `job_collaborators`, `pipeline_templates`, `pipeline_template_stages`, `candidates`, `applications`, `application_events`, `rejection_reasons`.**

Ejecutar vía MCP de Supabase (`execute_sql`, `project_id: "cgudnnlcwcotovcslgzu"`):

```sql
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('jobs','job_stages','job_collaborators','pipeline_templates',
                      'pipeline_template_stages','candidates','applications',
                      'application_events','rejection_reasons')
order by table_name, ordinal_position;
```

- [ ] **Paso 2: Listar las policies RLS reales de esas mismas tablas (para saber qué puede insertar cada rol sin adivinar).**

```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('jobs','job_stages','job_collaborators','candidates',
                     'applications','application_events')
order by tablename, cmd;
```

- [ ] **Paso 3: Anotar cualquier discrepancia contra los nombres usados en las Interfaces clave de este plan (arriba) y ajustar `JobFormSchema`/`get-jobs.ts`/`actions.ts` en las tareas siguientes a los nombres reales — nunca al revés.**

No hay commit en esta tarea — es solo la base de verdad para las siguientes.

---

## Tarea 2 — `materializeJobStages` + `createJob`

**Files:**
- Create: `src/lib/jobs/schema.ts`
- Create: `src/lib/jobs/materialize-stages.ts`
- Create: `src/lib/jobs/actions.ts` (solo `createJob` por ahora)

**Interfaces:**
- Consumes: `requireAdminOrAbove()` y `requireProfile()` de `src/lib/auth/dal.ts` (ya existen); columnas reales confirmadas en Tarea 1.
- Produces: `JobFormSchema`, `JobStatusSchema`, `materializeJobStages()`, `createJob()` — que las Tareas 3-6 consumen.

- [ ] **Paso 1: Escribir `src/lib/jobs/schema.ts`** con `JobStatusSchema` y `JobFormSchema` (ajustados a las columnas reales de Tarea 1).

- [ ] **Paso 2: Escribir `src/lib/jobs/materialize-stages.ts`.**

```ts
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Copia la plantilla de pipeline activa a job_stages en el momento de crear
 * la vacante — así editar la plantilla después no altera procesos en curso.
 */
export async function materializeJobStages(
  supabase: SupabaseClient,
  jobId: string,
  organizationId: string,
): Promise<{ error?: string }> {
  const { data: template } = await supabase
    .from("pipeline_templates")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("is_default", true)
    .single();

  if (!template) return { error: "No hay una plantilla de pipeline configurada para tu organización." };

  const { data: stages, error: stagesError } = await supabase
    .from("pipeline_template_stages")
    .select("name, type, position")
    .eq("pipeline_template_id", template.id)
    .order("position");

  if (stagesError || !stages || stages.length === 0) {
    return { error: "La plantilla de pipeline no tiene etapas configuradas." };
  }

  const rows = stages.map((s) => ({
    job_id: jobId,
    name: s.name,
    type: s.type,
    position: s.position,
  }));

  const { error: insertError } = await supabase.from("job_stages").insert(rows);
  if (insertError) return { error: "No se pudo preparar el pipeline de esta vacante." };
  return {};
}
```

(Ajustar nombres de columna a lo confirmado en Tarea 1 si difieren de `name`/`type`/`position`/`is_default`.)

- [ ] **Paso 3: Escribir `createJob` en `src/lib/jobs/actions.ts`.**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { JobFormSchema } from "./schema";
import { materializeJobStages } from "./materialize-stages";

export type JobActionResult = { error?: string; success?: string };

export async function createJob(
  _prevState: JobActionResult | undefined,
  formData: FormData,
): Promise<JobActionResult> {
  const profile = await requireProfile();
  if (profile.role === "colaborador") {
    return { error: "Tu perfil no puede solicitar vacantes." };
  }

  const parsed = JobFormSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos del formulario." };
  }

  const supabase = await createClient();
  const status = profile.role === "gestor" ? "pendiente_aprobacion" : "borrador";

  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      ...parsed.data,
      organization_id: profile.organization_id,
      requested_by: profile.id,
      owner_id: profile.role === "gestor" ? null : profile.id,
      status,
    })
    .select("id")
    .single();

  if (error || !job) {
    return { error: "No se pudo crear la vacante. Inténtalo de nuevo." };
  }

  const { error: stagesError } = await materializeJobStages(supabase, job.id, profile.organization_id);
  if (stagesError) {
    // La vacante ya existe pero sin pipeline — se deja visible para que un
    // admin la revise en vez de deshacer el insert (evita una vacante a
    // medio crear silenciosamente descartada).
    return { error: stagesError };
  }

  revalidatePath("/vacantes");
  redirect(`/vacantes/${job.id}`);
}
```

(Si `materializeJobStages` devuelve `{error: stagesError}` como un objeto `{error?: string}` — cuidado con el naming, el destructuring debe ser `const { error: stagesError }` sobre el resultado de `materializeJobStages`, no reusar `error` de la inserción anterior — usar nombres distintos como en el ejemplo.)

- [ ] **Paso 4: `npm run typecheck && npm run lint`** — deben salir limpios antes de seguir. No hay build todavía (faltan las páginas que usan esto); typecheck ya detecta errores de tipos en Server Actions no referenciadas.

- [ ] **Paso 5: Commit local (sin push — el push de fase va al final).**

```bash
git add src/lib/jobs/schema.ts src/lib/jobs/materialize-stages.ts src/lib/jobs/actions.ts
git commit -m "feat(vacantes): crear vacante + materializar pipeline al crearla"
```

---

## Tarea 3 — `getJobsForViewer` / `getJobById` + listado interno `/vacantes`

**Files:**
- Create: `src/lib/jobs/get-jobs.ts`
- Create: `src/components/vacantes/job-status-badge.tsx`
- Create: `src/components/vacantes/job-card.tsx`
- Create: `src/app/(app)/vacantes/page.tsx`
- Create: `src/app/(app)/vacantes/loading.tsx`

**Interfaces:**
- Consumes: `requireProfile()` de `src/lib/auth/dal.ts`; `JobStatus` de `src/lib/jobs/schema.ts`.
- Produces: `getJobsForViewer(profile)`, `JobListItem` — consumidos por Tarea 4 (detalle) y Tarea 9 (nav).

- [ ] **Paso 1: Escribir `src/lib/jobs/get-jobs.ts`.** RLS ya filtra por rol (Fase 2) — este archivo solo pide las columnas necesarias y ordena; no duplica lógica de permisos en el cliente.

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];
export type JobStatus = Database["public"]["Enums"]["job_status"];

export type JobListItem = {
  id: string;
  code: string;
  title: string;
  status: JobStatus;
  country: string;
  openings: number;
  published_at: string | null;
};

export async function getJobsForViewer(): Promise<JobListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("id, code, title, status, country, openings, published_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}
```

(Ajustar el nombre del enum `job_status` en `database.types.ts` — si Fase 2 lo llamó distinto, corregir aquí. Verificar con `grep -n "job_status\|Enums" src/lib/supabase/database.types.ts`.)

- [ ] **Paso 2: Escribir `job-status-badge.tsx`** — un `<span>` con color semántico por estado (usa `--success`/`--warning`/`--destructive`/`--muted-foreground`, nunca colores nuevos fuera de los tokens de `globals.css`):

```tsx
import type { JobStatus } from "@/lib/jobs/get-jobs";

const LABEL: Record<JobStatus, string> = {
  borrador: "Borrador",
  pendiente_aprobacion: "Pendiente de aprobación",
  abierta: "Abierta",
  pausada: "Pausada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

const STYLE: Record<JobStatus, string> = {
  borrador: "text-muted-foreground border-border",
  pendiente_aprobacion: "text-[#9A6B1F] border-[#9A6B1F]/40",
  abierta: "text-[#2F6F4E] border-[#2F6F4E]/40",
  pausada: "text-[#9A6B1F] border-[#9A6B1F]/40",
  cerrada: "text-muted-foreground border-border",
  cancelada: "text-[#B3261E] border-[#B3261E]/40",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-sm border px-2 text-xs ${STYLE[status]}`}>
      {LABEL[status]}
    </span>
  );
}
```

- [ ] **Paso 3: Escribir `job-card.tsx`** — tarjeta con borde de 1px (no sombra), `Link` a `/vacantes/[id]`, título en `font-serif`, código y país en `tabular-nums`/`text-muted-foreground`, `<JobStatusBadge>`.

- [ ] **Paso 4: Escribir `src/app/(app)/vacantes/page.tsx`.**

```tsx
import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { getJobsForViewer } from "@/lib/jobs/get-jobs";
import { JobCard } from "@/components/vacantes/job-card";

export default async function VacantesPage() {
  const profile = await requireProfile();
  const jobs = await getJobsForViewer();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[32px]">Vacantes</h1>
        {profile.role !== "colaborador" && (
          <Link
            href="/vacantes/nueva"
            className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white"
          >
            Solicitar vacante
          </Link>
        )}
      </div>

      {jobs.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          Todavía no hay vacantes {profile.role === "colaborador" ? "publicadas" : "para mostrar"}.
        </p>
      ) : (
        <div className="mt-8 grid gap-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Paso 5: Escribir `loading.tsx`** con 4 `<Skeleton>` apiladas del alto de una `job-card`.

- [ ] **Paso 6: `npm run typecheck && npm run lint && npm run build`** — el build ya debe compilar la ruta `/vacantes` como dinámica.

- [ ] **Paso 7: Verificación RLS real (no solo confiar en que "ya estaba probado en Fase 2"):** simular vía MCP `execute_sql` un `select` a `jobs` con JWT de `colaborador` de una organización con una vacante `borrador` y otra `abierta` — confirmar que solo ve la `abierta`. Documentar el resultado en el mensaje de commit o en napkin si sale algo inesperado.

- [ ] **Paso 8: Commit.**

```bash
git add src/lib/jobs/get-jobs.ts src/components/vacantes/job-status-badge.tsx src/components/vacantes/job-card.tsx "src/app/(app)/vacantes/page.tsx" "src/app/(app)/vacantes/loading.tsx"
git commit -m "feat(vacantes): listado interno de vacantes filtrado por rol"
```

---

## Tarea 4 — Formulario de alta `/vacantes/nueva` + `<JobForm>`

**Files:**
- Create: `src/components/vacantes/job-form.tsx`
- Create: `src/app/(app)/vacantes/nueva/page.tsx`

**Interfaces:**
- Consumes: `createJob` de Tarea 2, `requireProfile()`.
- Produces: `<JobForm>` reutilizado por Tarea 5 (edición) con una prop `mode: "create" | "edit"`.

- [ ] **Paso 1: Escribir `job-form.tsx`** con `useActionState(createJob, undefined)` (modo create) o recibiendo una action ya bindeada para editar (modo edit, Tarea 5). Todos los campos de `JobFormSchema`, `<ActionButton>` para el submit, `notifyError`/`notifySuccess` en un `useEffect` sobre `state` (mismo patrón que `branding-form.tsx`).

- [ ] **Paso 2: Escribir `nueva/page.tsx`** — `requireProfile()`, bloquea `colaborador` con `redirect("/vacantes")`, trae los `departments` de la organización para el `<select>`, renderiza `<JobForm mode="create" departments={departments} />`.

- [ ] **Paso 3: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 4: Commit.**

```bash
git add src/components/vacantes/job-form.tsx "src/app/(app)/vacantes/nueva/page.tsx"
git commit -m "feat(vacantes): formulario de alta de vacante"
```

**Checkpoint A (revisar antes de seguir):** con esto ya se puede, desde la app, solicitar/crear una vacante y verla en el listado con su estado correcto. Antes de avanzar a la Tarea 5, confirmar manualmente (lectura de código + `next build` + SQL) que un `gestor` queda en `pendiente_aprobacion` y un `admin` en `borrador`.

---

## Tarea 5 — Detalle `/vacantes/[id]` + acciones de aprobación/publicación/ciclo de vida

**Files:**
- Create: `src/components/vacantes/approval-actions.tsx`
- Create: `src/app/(app)/vacantes/[id]/page.tsx`
- Create: `src/app/(app)/vacantes/[id]/loading.tsx`
- Modify: `src/lib/jobs/actions.ts` (agregar `submitForApproval`, `approveAndPublish`, `rejectApproval`, `pauseJob`, `reopenJob`, `closeJob`, `cancelJob`, `deleteJobDraft`)

**Interfaces:**
- Consumes: `JobActionResult` (Tarea 2), `getJobById` (agregar a `get-jobs.ts` en esta tarea).
- Produces: nada consumido por tareas posteriores directamente (es una hoja del árbol), salvo que Tarea 9 (nav) enlaza aquí.

- [ ] **Paso 1: Agregar `getJobById` a `src/lib/jobs/get-jobs.ts`** (mismo patrón que `getJobsForViewer`, `select("*")` con `.eq("id", id).single()`, devuelve `null` si no hay fila — RLS decide si existe para este viewer).

- [ ] **Paso 2: Agregar las acciones de ciclo de vida a `src/lib/jobs/actions.ts`.** Todas siguen el mismo esqueleto: cargar el estado actual, validar la transición, `update`, `revalidatePath`. Ejemplo completo de una (las demás son variaciones directas — no hay lógica nueva que inventar, solo el `status` origen/destino cambia):

```ts
const VALID_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  borrador: ["pendiente_aprobacion", "abierta", "cancelada"],
  pendiente_aprobacion: ["abierta", "borrador", "cancelada"],
  abierta: ["pausada", "cerrada", "cancelada"],
  pausada: ["abierta", "cerrada", "cancelada"],
  cerrada: [],
  cancelada: [],
};

async function transitionJob(
  jobId: string,
  to: JobStatus,
  guard: (actorRole: AppRole, current: { status: JobStatus; requested_by: string }) => string | null,
): Promise<JobActionResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("jobs")
    .select("status, requested_by, organization_id")
    .eq("id", jobId)
    .single();

  if (!current) return { error: "No se encontró la vacante." };
  if (!VALID_TRANSITIONS[current.status].includes(to)) {
    return { error: "Esa vacante no puede pasar a ese estado desde donde está." };
  }

  const guardError = guard(profile.role, current);
  if (guardError) return { error: guardError };

  const extra = to === "abierta" && current.status !== "abierta" ? { published_at: new Date().toISOString() } : {};
  const { data, error } = await supabase
    .from("jobs")
    .update({ status: to, ...extra })
    .eq("id", jobId)
    .select("id");

  if (error || !data || data.length === 0) return { error: "No se pudo actualizar la vacante." };

  revalidatePath("/vacantes");
  revalidatePath(`/vacantes/${jobId}`);
  return { success: SUCCESS_MESSAGE[to] };
}

const SUCCESS_MESSAGE: Record<JobStatus, string> = {
  borrador: "Vacante regresada a borrador",
  pendiente_aprobacion: "Vacante enviada a aprobación",
  abierta: "Vacante publicada",
  pausada: "Vacante pausada",
  cerrada: "Vacante cerrada",
  cancelada: "Vacante cancelada",
};

export async function submitForApproval(jobId: string): Promise<JobActionResult> {
  return transitionJob(jobId, "pendiente_aprobacion", (role) =>
    role === "colaborador" ? "Tu perfil no puede enviar vacantes a aprobación." : null,
  );
}

export async function approveAndPublish(jobId: string): Promise<JobActionResult> {
  return transitionJob(jobId, "abierta", (role) =>
    role === "admin" || role === "super_admin" ? null : "Solo RH puede aprobar y publicar una vacante.",
  );
}

export async function pauseJob(jobId: string): Promise<JobActionResult> {
  return transitionJob(jobId, "pausada", (role) =>
    role === "admin" || role === "super_admin" ? null : "Solo RH puede pausar una vacante.",
  );
}

export async function reopenJob(jobId: string): Promise<JobActionResult> {
  return transitionJob(jobId, "abierta", (role) =>
    role === "admin" || role === "super_admin" ? null : "Solo RH puede reabrir una vacante.",
  );
}

export async function closeJob(jobId: string): Promise<JobActionResult> {
  return transitionJob(jobId, "cerrada", (role) =>
    role === "admin" || role === "super_admin" ? null : "Solo RH puede cerrar una vacante.",
  );
}

export async function cancelJob(jobId: string): Promise<JobActionResult> {
  return transitionJob(jobId, "cancelada", (role, current) => {
    if (role === "admin" || role === "super_admin") return null;
    if (role === "gestor" && current.requested_by === profileIdPlaceholder) return null; // ver nota
    return "No puedes cancelar esta vacante.";
  });
}
```

> Nota real para quien implemente esto (no placeholder — es una decisión de diseño a resolver en el momento): `cancelJob`'s guard necesita el `id` del actor para comparar con `current.requested_by`, pero `guard` como está tipado solo recibe `actorRole`. Antes de copiar el ejemplo de `cancelJob` tal cual, ampliar la firma de `guard` a `(actorRole: AppRole, actorId: string, current: {...}) => string | null` y pasar `profile.id` en `transitionJob`. Ajustar las demás llamadas a `guard` en consecuencia (reciben el parámetro de más y lo ignoran). Esto es un ajuste de tipos de 2 líneas, no una decisión de producto — la regla de producto ("un gestor puede cancelar lo que él mismo solicitó") ya está definida arriba.

- [ ] **Paso 3: `rejectApproval(jobId, reason)` y `deleteJobDraft(jobId)`** — `rejectApproval` es una `transitionJob(jobId, "borrador", ...)` que además guarda `reason` en un campo existente si la tabla lo tiene (confirmar en Tarea 1; si no existe columna para el motivo, usar `application_events`-style no aplica aquí porque es sobre `jobs` no `applications` — en ese caso, omitir el guardado del motivo por ahora y dejarlo anotado en el napkin como mejora de Fase 5, no bloquear la fase por una columna que no existe). `deleteJobDraft` solo permite borrar si `status === 'borrador'` y el actor es `requested_by` o admin+; usa `<DeleteButton>` en la UI, no aparece para otros estados.

- [ ] **Paso 4: Escribir `approval-actions.tsx`** — recibe `job` y `role`, decide qué botones mostrar según `job.status` y `role` (tabla de transición ya validada server-side, esto es solo UX para no mostrar botones que fallarían). Cada botón que no sea "cancelar/eliminar" es `<ActionButton>` con `useTransition` (patrón ya usado en `user-row.tsx` para `updateUserRole`/`toggleUserActive` — mismas dos funciones de referencia). "Cancelar" y "Eliminar borrador" usan `<DeleteButton>`.

- [ ] **Paso 5: Escribir `[id]/page.tsx`** — `requireProfile()`, `getJobById(id)`, `notFound()` si es `null` (RLS ya decidió que este viewer no debe verla), muestra todos los campos, `<JobStatusBadge>`, `<ApprovalActions job={job} role={profile.role} />`, y si `role !== "colaborador"` un botón "Referir candidato" que abre `<ReferCandidateDialog>` (Tarea 6).

- [ ] **Paso 6: `loading.tsx` con skeleton del detalle.**

- [ ] **Paso 7: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 8: Verificación de transición inválida:** simular vía MCP `execute_sql` (o por inspección directa del código, ya que `VALID_TRANSITIONS` es una tabla en memoria, no RLS) que `transitionJob` rechaza pasar de `cerrada` a `abierta` con el mensaje de error, no con una excepción cruda.

- [ ] **Paso 9: Commit.**

```bash
git add src/lib/jobs/actions.ts src/lib/jobs/get-jobs.ts src/components/vacantes/approval-actions.tsx "src/app/(app)/vacantes/[id]"
git commit -m "feat(vacantes): flujo de aprobación, publicación y ciclo de vida"
```

**Checkpoint B:** flujo interno completo — solicitar, aprobar, publicar, pausar, cerrar, cancelar — funciona de punta a punta dentro de la app. A partir de aquí, todo lo que sigue es portal público + postulación, un subsistema separado que no toca lo ya construido.

---

## Tarea 6 — Referidos internos

**Files:**
- Create: `src/components/vacantes/refer-candidate-dialog.tsx`
- Modify: `src/lib/jobs/actions.ts` (agregar `referCandidate`)

**Interfaces:**
- Consumes: `JobActionResult`, `createClient()` de `src/lib/supabase/server.ts`.
- Produces: nada consumido después (hoja del árbol).

- [ ] **Paso 1: Agregar `referCandidate` a `actions.ts`.**

```ts
const ReferCandidateSchema = z.object({
  full_name: z.string().trim().min(3).max(120),
  email: z.email(),
  phone: z.string().trim().min(6).max(30).optional(),
});

export async function referCandidate(
  jobId: string,
  _prevState: JobActionResult | undefined,
  formData: FormData,
): Promise<JobActionResult> {
  const profile = await requireProfile();
  const parsed = ReferCandidateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos del candidato." };
  }

  const supabase = await createClient();
  const email = parsed.data.email.toLowerCase();

  const { data: existing } = await supabase
    .from("candidates")
    .select("id")
    .eq("organization_id", profile.organization_id)
    .ilike("email", email)
    .maybeSingle();

  let candidateId = existing?.id;

  if (!candidateId) {
    const { data: created, error: createError } = await supabase
      .from("candidates")
      .insert({
        organization_id: profile.organization_id,
        full_name: parsed.data.full_name,
        email,
        phone: parsed.data.phone ?? null,
        source: "referido",
        referred_by: profile.id,
      })
      .select("id")
      .single();
    if (createError || !created) return { error: "No se pudo registrar al candidato." };
    candidateId = created.id;
  }

  const { error: applicationError } = await supabase.from("applications").insert({
    job_id: jobId,
    candidate_id: candidateId,
    organization_id: profile.organization_id,
  });

  if (applicationError) {
    // Violación de UNIQUE(job_id, candidate_id) esperada si ya había postulado.
    return { error: "Esta persona ya tiene una postulación registrada para esta vacante." };
  }

  revalidatePath(`/vacantes/${jobId}`);
  return { success: "Candidato referido" };
}
```

(Confirmar en Tarea 1 si `applications` necesita `stage_id` en el insert o tiene un `default` que lo resuelve al primer `job_stages` — si es `NOT NULL` sin default, este insert necesita antes un `select` a `job_stages` filtrando `position = 1` o `type = 'postulado'` y pasar ese `id`. No adivinar: confirmar contra el esquema real de Tarea 1 antes de escribir este paso.)

- [ ] **Paso 2: Escribir `refer-candidate-dialog.tsx`** — `<dialog>` (mismo patrón nativo que `confirm-dialog.tsx`), formulario con `useActionState(referCandidate.bind(null, jobId), undefined)`, `<ActionButton>`, cierra y `notifySuccess(state.success)` al terminar.

- [ ] **Paso 3: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 4: Commit.**

```bash
git add src/lib/jobs/actions.ts src/components/vacantes/refer-candidate-dialog.tsx
git commit -m "feat(vacantes): referidos internos desde el detalle de la vacante"
```

---

## Tarea 7 — Rate limiter simple

**Files:**
- Create: `src/lib/rate-limit.ts`

**Interfaces:**
- Produces: `checkRateLimit(key, opts?)` — consumido por Tarea 8.

- [ ] **Paso 1: Escribir `src/lib/rate-limit.ts`.**

```ts
import "server-only";

/**
 * Limitador en memoria del proceso — suficiente para Vercel en v1 porque el
 * endpoint público (/api/postular) es de bajo volumen (postulaciones, no
 * tráfico general) y una función serverless individual vive varios minutos
 * bajo carga sostenida antes de reciclarse. Si el volumen crece o se corre
 * en múltiples regiones simultáneas, esto necesita moverse a una tabla en
 * Postgres o a Upstash Redis — anotado en napkin como límite conocido, no
 * un bug a corregir ahora (YAGNI: no hay tráfico real todavía que lo exija).
 */
const hits = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  opts: { max?: number; windowMs?: number } = {},
): boolean {
  const max = opts.max ?? 5;
  const windowMs = opts.windowMs ?? 60_000;
  const now = Date.now();
  const entry = hits.get(key);

  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}
```

- [ ] **Paso 2: `npm run typecheck && npm run lint`.**

- [ ] **Paso 3: Commit.**

```bash
git add src/lib/rate-limit.ts
git commit -m "feat: rate limiter en memoria para endpoints públicos"
```

---

## Tarea 8 — Route Handler público `/api/postular`

**Files:**
- Create: `src/app/api/postular/route.ts`

**Interfaces:**
- Consumes: `createAdminClient()` de `src/lib/supabase/admin.ts`, `checkRateLimit()` de Tarea 7.
- Produces: el contrato HTTP consumido por `ApplicationForm` (Tarea 10).

- [ ] **Paso 1: Confirmar en Tarea 1 los nombres reales de columna de `candidates` (cv_file_path, cv_parsed, etc.) y el índice único `(organization_id, lower(email))` mencionado en el plan original — si el índice no existe con ese nombre exacto, buscarlo por `\d candidates` equivalente:

```sql
select indexname, indexdef from pg_indexes where tablename = 'candidates';
```

- [ ] **Paso 2: Escribir el Route Handler.**

```ts
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";

const ApplySchema = z.object({
  job_id: z.uuid(),
  full_name: z.string().trim().min(3).max(120),
  email: z.email(),
  phone: z.string().trim().min(6).max(30),
  current_role: z.string().trim().max(120).optional(),
  years_experience: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().int().min(0).max(60).optional(),
  ),
});

const MAX_CV_BYTES = 10 * 1024 * 1024;
const CV_EXTENSION_BY_MIME: Record<string, string> = { "application/pdf": "pdf" };

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  if (!checkRateLimit(`postular:${ip}`, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo." },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const parsed = ApplySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Revisa los datos del formulario." },
      { status: 400 },
    );
  }

  const cv = formData.get("cv");
  if (!(cv instanceof File) || cv.size === 0) {
    return NextResponse.json({ error: "Adjunta tu CV en PDF." }, { status: 400 });
  }
  if (cv.size > MAX_CV_BYTES) {
    return NextResponse.json({ error: "El CV pesa más de 10 MB. Comprímelo e inténtalo de nuevo." }, { status: 400 });
  }
  if (!(cv.type in CV_EXTENSION_BY_MIME)) {
    return NextResponse.json({ error: "El CV debe ser un PDF." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("id, organization_id, status, is_public")
    .eq("id", parsed.data.job_id)
    .single();

  if (!job || job.status !== "abierta" || !job.is_public) {
    return NextResponse.json({ error: "Esta vacante ya no está disponible." }, { status: 404 });
  }

  const email = parsed.data.email.toLowerCase();
  const { data: existingCandidate } = await admin
    .from("candidates")
    .select("id")
    .eq("organization_id", job.organization_id)
    .ilike("email", email)
    .maybeSingle();

  let candidateId = existingCandidate?.id as string | undefined;

  if (!candidateId) {
    const { data: created, error: createError } = await admin
      .from("candidates")
      .insert({
        organization_id: job.organization_id,
        full_name: parsed.data.full_name,
        email,
        phone: parsed.data.phone,
        current_role: parsed.data.current_role ?? null,
        years_experience: parsed.data.years_experience ?? null,
        source: "portal",
      })
      .select("id")
      .single();

    if (createError || !created) {
      return NextResponse.json({ error: "No se pudo registrar tu postulación. Inténtalo de nuevo." }, { status: 500 });
    }
    candidateId = created.id;
  }

  const { data: firstStage } = await admin
    .from("job_stages")
    .select("id")
    .eq("job_id", job.id)
    .order("position")
    .limit(1)
    .single();

  if (!firstStage) {
    return NextResponse.json({ error: "Esta vacante no tiene un proceso configurado todavía." }, { status: 500 });
  }

  const cvPath = `${candidateId}/${Date.now()}.pdf`;
  const { error: uploadError } = await admin.storage.from("cvs-privado").upload(cvPath, cv, {
    contentType: "application/pdf",
  });
  if (uploadError) {
    return NextResponse.json({ error: "No se pudo subir tu CV. Inténtalo de nuevo." }, { status: 500 });
  }

  const { error: applicationError } = await admin.from("applications").insert({
    job_id: job.id,
    candidate_id: candidateId,
    organization_id: job.organization_id,
    stage_id: firstStage.id,
    cv_file_path: cvPath,
  });

  if (applicationError) {
    return NextResponse.json(
      { error: "Ya tienes una postulación registrada para esta vacante." },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
```

(Ajustar `cv_file_path` a la tabla real — Tarea 1 puede mostrar que ese campo vive en `applications` o en un `attachments` separado; si es `attachments`, insertar ahí después de crear la `application` con su `id`, no en `applications` directo. No forzar el ejemplo si el esquema real difiere — seguir la fuente de verdad de Tarea 1.)

- [ ] **Paso 3: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 4: Verificación manual del contrato** (no hay test runner): con el servidor de dev corriendo, `curl -X POST http://localhost:3000/api/postular` sin body → debe responder 400 con `{error: "..."}` en español, nunca un stack de Next. (Nota: si este sandbox no tiene salida real a Supabase, este curl fallará más adelante en el `select` a `jobs` con el error de red ya documentado en napkin — confirmar solo que la validación Zod temprana funciona antes de ese punto, y dejar la prueba de la ruta completa para verificación en Vercel o por el usuario.)

- [ ] **Paso 5: Commit.**

```bash
git add src/app/api/postular/route.ts
git commit -m "feat(postular): endpoint público de postulación con service role"
```

---

## Tarea 9 — Portal público `/empleos` y `/empleos/[slug]`

**Files:**
- Create: `src/app/(public)/empleos/layout.tsx`
- Create: `src/app/(public)/empleos/page.tsx`
- Create: `src/app/(public)/empleos/loading.tsx`
- Create: `src/app/(public)/empleos/[slug]/page.tsx`
- Create: `src/app/(public)/empleos/[slug]/loading.tsx`
- Create: `src/components/empleos/job-public-card.tsx`

**Interfaces:**
- Consumes: `getOrganization()` de `src/lib/organizations/get-organization.ts` (ya existe, público por RLS — ver napkin punto 3e de Fase 3).
- Produces: la página que monta `<ApplicationForm>` (Tarea 10).

- [ ] **Paso 1: Escribir `layout.tsx`** — cabecera simple con logo/`platform_name` de `getOrganization()`, sin `AppHeader`/`FloatingNav` (esos son solo para `(app)`), fondo `bg-background`, `min-h-screen`.

- [ ] **Paso 2: Escribir `job-public-card.tsx`** — mismo lenguaje visual que `job-card.tsx` interno pero sin `<JobStatusBadge>` (todo lo que aparece aquí ya está `abierta`, no hace falta repetirlo) y con `Link` a `/empleos/[slug]`.

- [ ] **Paso 3: Escribir `page.tsx`** (listado):

```tsx
import { createClient } from "@/lib/supabase/server";
import { JobPublicCard } from "@/components/empleos/job-public-card";

export default async function EmpleosPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, slug, title, country, location, modality, published_at")
    .eq("status", "abierta")
    .eq("is_public", true)
    .order("published_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-serif text-[40px]">Vacantes abiertas</h1>
      {!jobs || jobs.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          No hay vacantes abiertas por ahora. Vuelve a revisar pronto.
        </p>
      ) : (
        <div className="mt-10 grid gap-3">
          {jobs.map((job) => (
            <JobPublicCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
```

(Esta lectura usa `createClient()` — el cliente de sesión, que para un visitante anónimo corre como `anon`. Esto es lectura pública permitida por RLS (`jobs` debe tener una policy `to anon` para `status='abierta' and is_public=true` — confirmar en Tarea 1/Paso 2 que existe; si no existe, es un gap real de la Fase 2 y hay que agregarla con `apply_migration` antes de seguir, documentándolo en `docs/database.md`.)

- [ ] **Paso 4: Escribir `[slug]/page.tsx`** — mismo patrón de `select`, `.eq("slug", slug).eq("status", "abierta").eq("is_public", true).single()`, `notFound()` si no hay fila, muestra descripción/requisitos/ubicación y monta `<ApplicationForm jobId={job.id} />` (Tarea 10).

- [ ] **Paso 5: `loading.tsx` en ambos niveles con skeletons.**

- [ ] **Paso 6: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 7: Commit.**

```bash
git add "src/app/(public)/empleos" src/components/empleos/job-public-card.tsx
git commit -m "feat(empleos): portal público de vacantes"
```

---

## Tarea 10 — `<ApplicationForm>` (cliente, sin `useActionState`)

**Files:**
- Create: `src/components/empleos/application-form.tsx`

**Interfaces:**
- Consumes: el contrato HTTP de `/api/postular` (Tarea 8).
- Produces: nada consumido después — última hoja del árbol de esta fase.

`useActionState` exige una Server Action; este formulario llama a un Route Handler por `fetch`, así que el estado de carga se maneja con `useState` + `startTransition`, siguiendo el mismo requisito de AGENTS.md (spinner + disabled + aria-busy) pero sin el helper `<ActionButton>` porque ese componente asume `useFormStatus`/`pending` de Server Action. Se construye el botón a mano UNA vez aquí, seg el mismo contrato visual:

- [ ] **Paso 1: Escribir el componente.**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

export function ApplicationForm({ jobId }: { jobId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("job_id", jobId);

    try {
      const res = await fetch("/api/postular", { method: "POST", body: formData });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "No se pudo enviar tu postulación.");
        return;
      }
      notifySuccess("Postulación enviada");
      router.push("/empleos?postulacion=enviada");
    } catch {
      setError("Se perdió la conexión. Tus datos no se enviaron — inténtalo de nuevo.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={pending}>
      <input name="full_name" required placeholder="Nombre completo" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
      <input name="email" type="email" required placeholder="Correo" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
      <input name="phone" required placeholder="Teléfono" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
      <input name="current_role" placeholder="Puesto actual (opcional)" className="h-11 rounded-md border border-border bg-background px-3 text-sm" />
      <input name="cv" type="file" accept="application/pdf" required className="text-sm" />

      {error && <p className="text-sm text-[#B3261E]">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex h-11 items-center justify-center rounded-md bg-accent text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Enviar postulación"}
      </button>
    </form>
  );
}
```

- [ ] **Paso 2: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 3: Commit.**

```bash
git add src/components/empleos/application-form.tsx
git commit -m "feat(empleos): formulario de postulación con subida de CV"
```

**Checkpoint C:** portal público completo — listar, ver detalle, postular con CV — de punta a punta.

---

## Tarea 11 — Integrar nav + revisión final de la fase

**Files:**
- Modify: `src/components/layout/floating-nav.tsx`

- [ ] **Paso 1: Agregar el ítem "Vacantes" a `itemsForRole()`**, para todos los roles, entre `/inicio` y `/configuracion`:

```ts
import { Briefcase, Home, Settings } from "lucide-react";
// ...
function itemsForRole(role: Role): NavItem[] {
  const base: NavItem[] = [
    { href: "/inicio", label: "Inicio", icon: Home },
    { href: "/vacantes", label: "Vacantes", icon: Briefcase },
  ];
  if (role === "admin" || role === "super_admin") {
    base.push({ href: "/configuracion", label: "Ajustes", icon: Settings });
  }
  return base;
}
```

(Con esto son 2-3 ítems según rol — sigue bajo el máximo de 5 de AGENTS.md.)

- [ ] **Paso 2: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 3: Commit.**

```bash
git add src/components/layout/floating-nav.tsx
git commit -m "feat(nav): agregar Vacantes al menú flotante"
```

- [ ] **Paso 4: Correr `/code-review --high` sobre todo el diff de la fase (todos los commits de las Tareas 1-11 juntos) y resolver cada hallazgo real hasta converger — mismo criterio que en la Fase 3 (verificar contra la base real con SQL antes de aceptar un hallazgo sobre RLS/triggers, no implementar a ciegas).**

- [ ] **Paso 5: Actualizar `.claude/napkin.md`** con cualquier trampa nueva encontrada durante la fase (ej. si el índice único de `candidates` tenía otro nombre, si `applications` necesitó una columna que no estaba en el plan original, cómo se resolvió la carga del CV si el esquema real difería del Route Handler de ejemplo).

- [ ] **Paso 6: Actualizar `docs/database.md`** solo si Tarea 1/Paso 3 o Tarea 9/Paso 3 encontraron un gap real que requirió una migración nueva (policy pública faltante en `jobs`, por ejemplo) — documentar esa migración igual que se documentaron las 25-28 de la Fase 3.

- [ ] **Paso 7: Actualizar la tabla "Estado del proyecto" de `README.md`** — Fase 4 pasa a ✅.

- [ ] **Paso 8: Push de cierre de fase (regla obligatoria de AGENTS.md — una sola vez, con todo lo de la Fase 4 ya revisado).**

```bash
git push -u origin claude/ats-platform-design-8ve51p
```

---

## Self-Review (hecho al escribir este plan)

- **Cobertura del alcance:** CRUD + aprobación (Tareas 2-5) ✓, materialización de pipeline (Tarea 2) ✓, portal público (Tareas 9-10) ✓, postulación con CV + dedupe + rate limit (Tareas 7-8) ✓, referidos internos (Tarea 6) ✓, listado interno por rol (Tarea 3) ✓, nav (Tarea 11) ✓. Fuera de alcance a propósito (Fase 5, no de esta fase): kanban de arrastre, perfil de candidato con timeline, notas, calificación, rechazo con motivo estructurado.
- **Placeholders:** el único punto marcado explícitamente como "ajustar contra la base real" (Tarea 1) es intencional — este plan depende de un esquema ya aplicado por otra fase que este agente no escribió en esta sesión de planeación, así que **no puede** inventar nombres de columna con certeza; por eso Tarea 1 existe como paso obligatorio antes de escribir código, no como placeholder de pereza.
- **Consistencia de tipos:** `JobActionResult` se define una vez (Tarea 2) y se reusa literalmente en Tareas 5, 6, 9 sin redefinir con otro shape. `JobStatus` se define en `get-jobs.ts` a partir del enum generado (Tarea 3) — Tarea 2 debe importar ese mismo tipo en vez de redeclarar el `JobStatusSchema` de Zod como fuente de verdad de tipos; ambos deben coincidir (Zod para validar input externo, el enum de Supabase para tipar lo que ya viene de la base) — anotado en Tarea 5 vía el `Record<JobStatus, ...>`.
