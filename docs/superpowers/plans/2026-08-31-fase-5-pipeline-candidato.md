# Fase 5 — Pipeline kanban y perfil de candidato — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kanban de arrastrar y soltar por vacante (mover una postulación de etapa), detalle de postulación con CV embebido (URL firmada) y timeline de eventos, notas con privacidad, calificación, rechazo con motivo y contratación, y una lista de postulaciones con filtros básicos.

**Architecture:** Server Components + Server Actions de sesión para todo lo interno (RLS decide el acceso real por vacante vía `can_access_job`); el kanban es el único componente de cliente con estado local no trivial (`@hello-pangea/dnd`), con actualización optimista y reversión en error. El esquema (`applications`, `application_events`, `notes`, `attachments`, `rejection_reasons`, `job_stages`) ya existe desde la Fase 2.

**Tech Stack:** Next.js 16 App Router, Server Actions, Zod v4, `@hello-pangea/dnd` (ya en package.json), Supabase (Postgres + Storage signed URLs), Tailwind v4.

**Spec:** `/root/.claude/plans/quiero-que-usemos-este-ethereal-acorn.md` (sección "Fase 5"); `.claude/napkin.md` sección "Vacantes y postulación (Fase 4)" — los hallazgos de esa fase (cliente admin vs. sesión, `.eq()` no `.ilike()`, compare-and-swap, ruta de Storage) aplican aquí igual.

**Alcance recortado a propósito:** no se construye una página de "perfil de candidato" que agregue todas sus postulaciones en una sola vista — `application_events`/`notes`/`attachments` están todos scoped por `application_id`, no por `candidate_id`, así que el timeline real vive por postulación. El "perfil" de esta fase es la página de detalle de una postulación (candidato + CV + timeline de ESA postulación); una vista que agregue historial de un candidato a través de varias vacantes queda para cuando haya una necesidad real de eso. Tampoco se agrega un tipo de evento para "contratada" (el enum `application_event_type` no lo tiene) — contratar es un cambio de `applications.status`, auditable por sí mismo; no se fuerza un evento que no existe en el esquema.

## Global Constraints

(Mismas que Fase 4, repetidas por completitud)
- Todo el texto de interfaz en español, cero inglés.
- Todo botón que muta datos usa `<ActionButton>`.
- Toda mutación exitosa llama `notifySuccess("<mensaje concreto>")`.
- Rechazar/contratar/mover de etapa son transiciones de estado, NO borrados — nunca `<DeleteButton>` para eso (lección de Fase 4). `<DeleteButton>` solo si algo se elimina de verdad (esta fase no elimina nada).
- Skeletons en cada `loading.tsx` nuevo.
- Zod en cada Server Action.
- **Antes de escribir una query nueva contra una tabla, confirmar la política RLS real con SQL — no asumir.** (Tarea 1 ya lo hizo para esta fase; ver hallazgos abajo.)
- Toda operación que necesite una verdad de la organización más allá de lo que el actor ve por RLS usa `createAdminClient()` (lección de Fase 4).
- CVs solo por URL firmada de 60 s (`createSignedUrl`), nunca pública.

## Hallazgos de esquema/RLS ya confirmados (no repetir la verificación)

- `applications_update`: `org match AND (is_admin_or_above() OR can_access_job(job_id))` — mover de etapa, calificar, rechazar y contratar usan el cliente de sesión normal; RLS ya filtra correctamente por vacante.
- `application_events_select`/`_insert`: mismo patrón, vía `EXISTS (applications a WHERE a.id = application_id AND (admin_or_above OR can_access_job(a.job_id)))`.
- `notes_insert`: `author_id` DEBE ser `auth.uid()` (no se puede escribir una nota "a nombre de" otra persona) + `can_access_job`/admin.
- `notes_select`: el autor SIEMPRE ve su propia nota (incluso si es privada); además ven las no-privadas quienes tienen acceso a la vacante, y las privadas solo admin+. Un `gestor` puede escribir una nota privada y seguir viéndola — no hace falta bloquear el checkbox `is_private` para nadie que ya pueda escribir notas.
- `rejection_reasons_select`: cualquier autenticado de la organización ve el catálogo completo (6 motivos ya sembrados). Solo admin+ puede crear/editar motivos (no se toca en esta fase).
- **Ruta de Storage de CVs**: `cvs_privado_select` exige `(storage.foldername(name))[2]::uuid = candidate_id` — ya corregido en el fix previo a esta fase (`src/lib/jobs/create-application.ts`). La URL firmada se genera con `createSignedUrl(candidate.cv_file_path, 60)` usando el cliente de sesión (RLS de Storage decide si el actor puede leerlo vía `can_access_candidate`).
- `job_stages_select`: ya cubre lectura para quien puede ver la vacante (público+abierta, o `can_access_job`) — el kanban puede leer las columnas con el cliente de sesión sin problema (a diferencia de `job_stages_write_admin`/`pipeline_templates_admin`, que siguen siendo admin-only y no se tocan en esta fase).

## Mapa de archivos

**Dominio de postulaciones:**
- `src/lib/applications/schema.ts` — `NoteSchema`, `RejectSchema`, `RATING_MIN`/`RATING_MAX`.
- `src/lib/applications/get-applications.ts` — `getKanbanData(jobId)`, `getApplicationDetail(applicationId)`.
- `src/lib/applications/actions.ts` — `moveApplicationStage`, `addNote`, `setRating`, `rejectApplication`, `hireApplication`, `reopenApplication` (por si se rechazó por error).
- `src/lib/candidates/get-signed-cv-url.ts` — `getSignedCvUrl(cvFilePath)`.

**Vistas internas:**
- `src/app/(app)/vacantes/[id]/pipeline/page.tsx` + `loading.tsx` — kanban.
- `src/app/(app)/postulaciones/[applicationId]/page.tsx` + `loading.tsx` — detalle de postulación (candidato, CV, timeline, notas, acciones).
- `src/app/(app)/candidatos/page.tsx` + `loading.tsx` — lista/búsqueda de postulaciones con filtros.

**Componentes:**
- `src/components/pipeline/kanban-board.tsx` (cliente, `@hello-pangea/dnd`).
- `src/components/pipeline/kanban-column.tsx`, `kanban-card.tsx`.
- `src/components/postulaciones/application-timeline.tsx` — renderiza `application_events` en orden cronológico con texto humano por tipo.
- `src/components/postulaciones/note-form.tsx`, `note-list.tsx`.
- `src/components/postulaciones/rating-stars.tsx` (cliente, `useTransition`).
- `src/components/postulaciones/reject-dialog.tsx`, `hire-button.tsx`.
- `src/components/postulaciones/cv-link.tsx` — genera y muestra el enlace firmado (client component, pide una URL fresca al abrir para no dejar una firmada de hace rato circulando).

**Nav:**
- `src/components/layout/floating-nav.tsx` — agregar "Candidatos" para admin+/gestor (colaborador no gestiona candidatos, solo refiere).
- `src/app/(app)/vacantes/[id]/page.tsx` — agregar enlace "Ver pipeline" cuando `job.status` no es borrador/pendiente_aprobacion (hay algo que mostrar).

## Interfaces clave

```ts
// src/lib/applications/schema.ts
export const RATING_MIN = 1;
export const RATING_MAX = 5;

export const NoteSchema = z.object({
  body: z.string().trim().min(3, { error: "Escribe una nota." }).max(2000, { error: "La nota es muy larga." }),
  is_private: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const RejectSchema = z.object({
  rejection_reason_id: z.uuid({ error: "Elige un motivo de rechazo." }),
});
```

```ts
// src/lib/applications/get-applications.ts
export type KanbanStage = { id: string; name: string; position: number };
export type KanbanCard = {
  id: string;
  candidateId: string;
  candidateName: string;
  rating: number | null;
  stageId: string;
  appliedAt: string;
};
export type KanbanData = { stages: KanbanStage[]; cards: KanbanCard[] };
export async function getKanbanData(jobId: string): Promise<KanbanData>;

export type ApplicationEvent = {
  id: string;
  type: Database["public"]["Enums"]["application_event_type"];
  actorName: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};
export type ApplicationNote = { id: string; authorId: string; authorName: string; body: string; isPrivate: boolean; createdAt: string };
export type ApplicationDetail = {
  id: string;
  status: Database["public"]["Enums"]["application_status"];
  rating: number | null;
  stageId: string;
  stageName: string;
  jobId: string;
  jobTitle: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  cvFilePath: string | null;
  rejectionReasonLabel: string | null;
  events: ApplicationEvent[];
  notes: ApplicationNote[];
};
export async function getApplicationDetail(applicationId: string): Promise<ApplicationDetail | null>;
```

```ts
// src/lib/applications/actions.ts
export type ApplicationActionResult = { error?: string; success?: string };
export async function moveApplicationStage(applicationId: string, fromStageId: string, toStageId: string): Promise<ApplicationActionResult>;
export async function addNote(applicationId: string, _prevState: ApplicationActionResult | undefined, formData: FormData): Promise<ApplicationActionResult>;
export async function setRating(applicationId: string, rating: number): Promise<ApplicationActionResult>;
export async function rejectApplication(applicationId: string, _prevState: ApplicationActionResult | undefined, formData: FormData): Promise<ApplicationActionResult>;
export async function hireApplication(applicationId: string): Promise<ApplicationActionResult>;
```

```ts
// src/lib/candidates/get-signed-cv-url.ts
export async function getSignedCvUrl(cvFilePath: string): Promise<string | null>;
```

---

## Tarea 1 — Confirmar el resto del esquema real y sembrar datos de prueba mínimos

El esquema y las políticas centrales ya están confirmados arriba ("Hallazgos de esquema/RLS ya confirmados"). Falta solo lo específico de esta tarea: cómo se ve `applications.rating` (rango real) y si hay algo con qué probar el kanban (la base está vacía — 0 `jobs`, 0 `candidates`).

- [ ] **Paso 1: Confirmar el tipo y rango de `applications.rating`.**

```sql
select column_name, data_type from information_schema.columns
where table_name = 'applications' and column_name = 'rating';
```

`smallint` nullable, sin `CHECK` — el rango 1-5 se enfuerza solo en Zod (`RATING_MIN`/`RATING_MAX` de arriba), documentar en el napkin si conviene un `CHECK (rating between 1 and 5)` a nivel de base (evaluar si vale la pena una migración; no bloquear la fase por esto si el tiempo aprieta — el rango ya validado en Zod cubre el 100% de la escritura porque todo pasa por Server Actions, nunca por un cliente `anon`).

- [ ] **Paso 2: Sembrar una vacante `abierta` con dos candidatos y postulaciones vía SQL directo (bypass de RLS, solo para poder ver el kanban con datos reales durante el desarrollo — no es parte del producto).** Usar el MCP de Supabase, insertando en `jobs` (`status='abierta'`, `is_public=true`, con sus `job_stages` ya materializados manualmente con las 6 etapas del pipeline por defecto), `candidates` y `applications`. Documentar en el mensaje de commit si se deja o se limpia al cerrar la fase — preferible limpiarlo (`delete from applications; delete from candidates; delete from job_stages; delete from jobs;` filtrando por el título de prueba) antes del push de cierre, para no dejar datos falsos en la base de producción real del usuario.

No hay commit en esta tarea.

---

## Tarea 2 — `getKanbanData` + `getApplicationDetail` (lectura)

**Files:**
- Create: `src/lib/applications/get-applications.ts`

**Interfaces:**
- Produce los tipos `KanbanData`/`ApplicationDetail` de la sección "Interfaces clave" — Tareas 3 y 5 los consumen.

- [ ] **Paso 1: Escribir `getKanbanData`.**

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type KanbanStage = { id: string; name: string; position: number };
export type KanbanCard = {
  id: string;
  candidateId: string;
  candidateName: string;
  rating: number | null;
  stageId: string;
  appliedAt: string;
};
export type KanbanData = { stages: KanbanStage[]; cards: KanbanCard[] };

export async function getKanbanData(jobId: string): Promise<KanbanData> {
  const supabase = await createClient();

  const { data: stages } = await supabase
    .from("job_stages")
    .select("id, name, position")
    .eq("job_id", jobId)
    .order("position");

  const { data: applications } = await supabase
    .from("applications")
    .select("id, stage_id, rating, applied_at, candidates(id, full_name)")
    .eq("job_id", jobId)
    .eq("status", "activa");

  const cards: KanbanCard[] = (applications ?? []).map((a) => ({
    id: a.id,
    candidateId: a.candidates!.id,
    candidateName: a.candidates!.full_name,
    rating: a.rating,
    stageId: a.stage_id,
    appliedAt: a.applied_at,
  }));

  return { stages: stages ?? [], cards };
}
```

(Confirmar en Tarea 1 si el nombre de la relación embebida es `candidates` — Supabase infiere el nombre del `foreignKeyName`; si el `select` embebido falla en typecheck/build, revisar `database.types.ts` para el nombre exacto de la relación `applications -> candidates` y ajustar. El operador `!` asume que la FK es NOT NULL, que sí lo es en `applications.candidate_id`.)

- [ ] **Paso 2: Escribir `getApplicationDetail`** — un `select` con relaciones embebidas a `candidates`, `jobs`, `job_stages`, `rejection_reasons`, más dos queries separadas para `application_events` (con `actor_id` resuelto a nombre vía `profiles`) y `notes` (con `author_id` resuelto a nombre vía `profiles`). RLS de `notes_select` y `application_events_select` ya filtran lo que corresponde — no hay que replicar esa lógica en el cliente.

```ts
export type ApplicationEvent = {
  id: string;
  type: Database["public"]["Enums"]["application_event_type"];
  actorName: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};
export type ApplicationNote = {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  isPrivate: boolean;
  createdAt: string;
};
export type ApplicationDetail = {
  id: string;
  status: Database["public"]["Enums"]["application_status"];
  rating: number | null;
  stageId: string;
  stageName: string;
  jobId: string;
  jobTitle: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string | null;
  cvFilePath: string | null;
  rejectionReasonLabel: string | null;
  events: ApplicationEvent[];
  notes: ApplicationNote[];
};

export async function getApplicationDetail(applicationId: string): Promise<ApplicationDetail | null> {
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("applications")
    .select(
      "id, status, rating, stage_id, job_stages(name), job_id, jobs(title), candidate_id, candidates(full_name, email, phone, cv_file_path), rejection_reason_id, rejection_reasons(label)",
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (!app) return null;

  const [{ data: events }, { data: notes }] = await Promise.all([
    supabase
      .from("application_events")
      .select("id, type, payload, created_at, actor_id, profiles(display_name)")
      .eq("application_id", applicationId)
      .order("created_at"),
    supabase
      .from("notes")
      .select("id, author_id, body, is_private, created_at, profiles(display_name)")
      .eq("application_id", applicationId)
      .order("created_at"),
  ]);

  return {
    id: app.id,
    status: app.status,
    rating: app.rating,
    stageId: app.stage_id,
    stageName: app.job_stages!.name,
    jobId: app.job_id,
    jobTitle: app.jobs!.title,
    candidateId: app.candidate_id,
    candidateName: app.candidates!.full_name,
    candidateEmail: app.candidates!.email,
    candidatePhone: app.candidates!.phone,
    cvFilePath: app.candidates!.cv_file_path,
    rejectionReasonLabel: app.rejection_reasons?.label ?? null,
    events: (events ?? []).map((e) => ({
      id: e.id,
      type: e.type,
      actorName: e.profiles?.display_name ?? null,
      payload: (e.payload as Record<string, unknown>) ?? {},
      createdAt: e.created_at,
    })),
    notes: (notes ?? []).map((n) => ({
      id: n.id,
      authorId: n.author_id,
      authorName: n.profiles?.display_name ?? "Alguien",
      body: n.body,
      isPrivate: n.is_private,
      createdAt: n.created_at,
    })),
  };
}
```

(Mismo comentario que el paso 1 sobre nombres de relaciones embebidas — ajustar contra lo que `database.types.ts` genere realmente si el nombre difiere.)

- [ ] **Paso 3: `npm run typecheck && npm run lint`** — sin páginas todavía que las usen, esto valida que las relaciones embebidas compilan contra `database.types.ts`.

- [ ] **Paso 4: Commit.**

```bash
git add src/lib/applications/get-applications.ts
git commit -m "feat(pipeline): lectura de datos para el kanban y el detalle de postulación"
```

---

## Tarea 3 — Kanban: componentes + Server Action de mover etapa

**Files:**
- Create: `src/lib/applications/actions.ts` (solo `moveApplicationStage` por ahora)
- Create: `src/components/pipeline/kanban-card.tsx`
- Create: `src/components/pipeline/kanban-column.tsx`
- Create: `src/components/pipeline/kanban-board.tsx`
- Create: `src/app/(app)/vacantes/[id]/pipeline/page.tsx`
- Create: `src/app/(app)/vacantes/[id]/pipeline/loading.tsx`

**Interfaces:**
- Consume `getKanbanData` (Tarea 2), `requireProfile()`.
- Produce `moveApplicationStage`, reusado tal cual en Tarea 4 si hiciera falta (no debería).

- [ ] **Paso 1: Escribir `moveApplicationStage` en `src/lib/applications/actions.ts`.**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type ApplicationActionResult = { error?: string; success?: string };

export async function moveApplicationStage(
  applicationId: string,
  fromStageId: string,
  toStageId: string,
): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  if (profile.role === "colaborador") return { error: "Tu perfil no puede mover postulaciones." };
  if (fromStageId === toStageId) return { success: "Sin cambios" };

  const supabase = await createClient();

  // Compare-and-swap: si alguien más ya la movió desde que esta pantalla
  // cargó, `fromStageId` ya no coincide con la fila real y el UPDATE no
  // afecta nada — evita que dos arrastres simultáneos se pisen en silencio
  // (mismo patrón que las transiciones de estado de vacantes en Fase 4).
  const { data, error } = await supabase
    .from("applications")
    .update({ stage_id: toStageId, stage_changed_at: new Date().toISOString(), stage_changed_by: profile.id })
    .eq("id", applicationId)
    .eq("stage_id", fromStageId)
    .select("id, organization_id")
    .single();

  if (error || !data) {
    return { error: "Alguien más ya movió esta postulación. Actualiza la página." };
  }

  await supabase.from("application_events").insert({
    organization_id: data.organization_id,
    application_id: applicationId,
    type: "etapa_cambiada",
    actor_id: profile.id,
    payload: { from: fromStageId, to: toStageId },
  });

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Etapa actualizada" };
}
```

- [ ] **Paso 2: Escribir `kanban-card.tsx`** — tarjeta simple: nombre del candidato (`font-medium text-sm`), estrellas de calificación si existe (`rating` como texto `★ {n}`), `Link` al detalle en `/postulaciones/[id]` (abre en la misma pestaña — arrastrar no debe competir con el link, usar `<Draggable>` de `@hello-pangea/dnd` envolviendo la tarjeta completa y el `Link` dentro, que es el patrón documentado de esa librería para "tarjeta arrastrable con contenido clickeable").

- [ ] **Paso 3: Escribir `kanban-column.tsx`** — envuelve un `<Droppable droppableId={stage.id}>`, título de la columna (`stage.name`, `text-[11px] uppercase tracking-wide`), contador de tarjetas, `overflow-y-auto` con alto máximo para que columnas largas no rompan el layout.

- [ ] **Paso 4: Escribir `kanban-board.tsx`.**

```tsx
"use client";

import { useState, useTransition } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { moveApplicationStage } from "@/lib/applications/actions";
import { notifyError } from "@/lib/notifications/toast";
import { KanbanColumn } from "./kanban-column";
import type { KanbanData } from "@/lib/applications/get-applications";

export function KanbanBoard({ initialData }: { initialData: KanbanData }) {
  const [cards, setCards] = useState(initialData.cards);
  const [, startTransition] = useTransition();

  function handleDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const toStageId = destination.droppableId;
    const fromStageId = source.droppableId;
    const previousCards = cards;

    // Optimista: la tarjeta se ve en su nueva columna de inmediato.
    setCards((current) =>
      current.map((c) => (c.id === draggableId ? { ...c, stageId: toStageId } : c)),
    );

    startTransition(async () => {
      const res = await moveApplicationStage(draggableId, fromStageId, toStageId);
      if (res.error) {
        setCards(previousCards);
        notifyError(res.error);
      }
    });
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {initialData.stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            cards={cards.filter((c) => c.stageId === stage.id)}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
```

- [ ] **Paso 5: Escribir `[id]/pipeline/page.tsx`.**

```tsx
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getJobById } from "@/lib/jobs/get-jobs";
import { getKanbanData } from "@/lib/applications/get-applications";
import { KanbanBoard } from "@/components/pipeline/kanban-board";

export default async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();
  const job = await getJobById(id);
  if (!job) notFound();

  const data = await getKanbanData(id);

  return (
    <div>
      <h1 className="font-serif text-[32px]">{job.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pipeline · {data.cards.length} postulaciones activas</p>
      <div className="mt-8">
        <KanbanBoard initialData={data} />
      </div>
    </div>
  );
}
```

- [ ] **Paso 6: `loading.tsx`** con 3-4 `<Skeleton>` simulando columnas (`h-96 w-64` cada una, en fila).

- [ ] **Paso 7: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 8: Verificación de la carrera con SQL** (mismo patrón que Fase 3/4): confirmar que un `UPDATE ... WHERE id = ? AND stage_id = ?` con un `stage_id` que ya no coincide afecta 0 filas — comportamiento esperado del compare-and-swap, no hace falta programar un test para esto, basta con leer la consulta y confirmar que el `.eq("stage_id", fromStageId)` está ahí antes de dar el paso por bueno.

- [ ] **Paso 9: Commit.**

```bash
git add src/lib/applications/actions.ts src/components/pipeline "src/app/(app)/vacantes/[id]/pipeline"
git commit -m "feat(pipeline): kanban de arrastrar y soltar para mover postulaciones de etapa"
```

**Checkpoint A:** el kanban funciona de punta a punta — arrastrar una tarjeta mueve la postulación, con reversión visual si el servidor rechaza el cambio.

---

## Tarea 4 — `getSignedCvUrl` + `<CvLink>`

**Files:**
- Create: `src/lib/candidates/get-signed-cv-url.ts`
- Create: `src/components/postulaciones/cv-link.tsx`

- [ ] **Paso 1: Escribir `getSignedCvUrl`.**

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";

/** RLS de Storage (cvs_privado_select) decide si el actor puede leer esta ruta. */
export async function getSignedCvUrl(cvFilePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("cvs-privado").createSignedUrl(cvFilePath, 60);
  if (error || !data) return null;
  return data.signedUrl;
}
```

- [ ] **Paso 2: Escribir `cv-link.tsx`** — Server Component simple (no necesita ser cliente: se resuelve en el propio render de la página de detalle, ya que una URL firmada de 60 s solo tiene sentido en el momento en que se sirve el HTML — si el usuario tarda más de 60 s en hacer clic, falla, y ese es el trade-off aceptado del propio diseño de "nunca URL pública").

```tsx
import { getSignedCvUrl } from "@/lib/candidates/get-signed-cv-url";

export async function CvLink({ cvFilePath }: { cvFilePath: string | null }) {
  if (!cvFilePath) return <p className="text-sm text-muted-foreground">Sin CV adjunto.</p>;
  const url = await getSignedCvUrl(cvFilePath);
  if (!url) return <p className="text-sm text-muted-foreground">No se pudo generar el enlace del CV.</p>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent underline">
      Ver CV (enlace válido por 60 segundos)
    </a>
  );
}
```

- [ ] **Paso 3: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 4: Commit.**

```bash
git add src/lib/candidates/get-signed-cv-url.ts src/components/postulaciones/cv-link.tsx
git commit -m "feat(candidatos): URL firmada de 60s para ver el CV desde la app"
```

---

## Tarea 5 — Detalle de postulación: timeline, notas, calificación, rechazo, contratación

**Files:**
- Create: `src/lib/applications/schema.ts`
- Modify: `src/lib/applications/actions.ts` (agregar `addNote`, `setRating`, `rejectApplication`, `hireApplication`, `reopenApplication`)
- Create: `src/components/postulaciones/application-timeline.tsx`
- Create: `src/components/postulaciones/note-form.tsx`
- Create: `src/components/postulaciones/note-list.tsx`
- Create: `src/components/postulaciones/rating-stars.tsx`
- Create: `src/components/postulaciones/reject-dialog.tsx`
- Create: `src/components/postulaciones/hire-button.tsx`
- Create: `src/app/(app)/postulaciones/[applicationId]/page.tsx`
- Create: `src/app/(app)/postulaciones/[applicationId]/loading.tsx`

**Interfaces:**
- Consume `getApplicationDetail` (Tarea 2), `CvLink` (Tarea 4).

- [ ] **Paso 1: Escribir `src/lib/applications/schema.ts`.**

```ts
import { z } from "zod";

export const RATING_MIN = 1;
export const RATING_MAX = 5;

export const NoteSchema = z.object({
  body: z.string().trim().min(3, { error: "Escribe una nota." }).max(2000, { error: "La nota es muy larga." }),
  is_private: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const RejectSchema = z.object({
  rejection_reason_id: z.uuid({ error: "Elige un motivo de rechazo." }),
});
```

- [ ] **Paso 2: Agregar las acciones restantes a `src/lib/applications/actions.ts`.**

```ts
import { z } from "zod";
import { NoteSchema, RejectSchema } from "./schema";

export async function addNote(
  applicationId: string,
  _prevState: ApplicationActionResult | undefined,
  formData: FormData,
): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  const parsed = NoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa la nota." };

  const supabase = await createClient();
  const { data: note, error } = await supabase
    .from("notes")
    .insert({
      organization_id: profile.organization_id,
      application_id: applicationId,
      author_id: profile.id,
      body: parsed.data.body,
      is_private: parsed.data.is_private,
    })
    .select("id")
    .single();

  if (error || !note) return { error: "No se pudo guardar la nota." };

  await supabase.from("application_events").insert({
    organization_id: profile.organization_id,
    application_id: applicationId,
    type: "nota_agregada",
    actor_id: profile.id,
    payload: { is_private: parsed.data.is_private },
  });

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Nota agregada" };
}

export async function setRating(applicationId: string, rating: number): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  const parsed = z.number().int().min(0).max(5).safeParse(rating);
  if (!parsed.success) return { error: "Calificación inválida." };

  const supabase = await createClient();
  const value = parsed.data === 0 ? null : parsed.data;
  const { data, error } = await supabase
    .from("applications")
    .update({ rating: value })
    .eq("id", applicationId)
    .select("organization_id")
    .single();

  if (error || !data) return { error: "No se pudo guardar la calificación." };

  await supabase.from("application_events").insert({
    organization_id: data.organization_id,
    application_id: applicationId,
    type: "calificacion_cambiada",
    actor_id: profile.id,
    payload: { rating: value },
  });

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Calificación guardada" };
}

export async function rejectApplication(
  applicationId: string,
  _prevState: ApplicationActionResult | undefined,
  formData: FormData,
): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  if (profile.role === "colaborador") return { error: "Tu perfil no puede rechazar postulaciones." };

  const parsed = RejectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Elige un motivo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ status: "rechazada", rejection_reason_id: parsed.data.rejection_reason_id })
    .eq("id", applicationId)
    .eq("status", "activa")
    .select("organization_id")
    .single();

  if (error || !data) return { error: "Esta postulación ya no está activa." };

  await supabase.from("application_events").insert({
    organization_id: data.organization_id,
    application_id: applicationId,
    type: "rechazada",
    actor_id: profile.id,
    payload: { rejection_reason_id: parsed.data.rejection_reason_id },
  });

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Postulación rechazada" };
}

export async function hireApplication(applicationId: string): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  if (profile.role === "colaborador") return { error: "Tu perfil no puede contratar." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ status: "contratada" })
    .eq("id", applicationId)
    .eq("status", "activa")
    .select("id")
    .single();

  if (error || !data) return { error: "Esta postulación ya no está activa." };

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Candidato contratado" };
}

export async function reopenApplication(applicationId: string): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  if (profile.role === "colaborador") return { error: "Tu perfil no puede reabrir postulaciones." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ status: "activa", rejection_reason_id: null })
    .eq("id", applicationId)
    .eq("status", "rechazada")
    .select("id")
    .single();

  if (error || !data) return { error: "Esta postulación no está rechazada." };

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Postulación reabierta" };
}
```

(`hireApplication` no inserta un `application_events` propio — el enum `application_event_type` no tiene un valor para "contratada"; el cambio de `applications.status` ya es el registro. No forzar un tipo de evento que no existe en el esquema — ver "Alcance recortado a propósito" arriba.)

- [ ] **Paso 3: Escribir `application-timeline.tsx`** — mapea cada `ApplicationEvent.type` a una frase en español:

```tsx
import type { ApplicationEvent } from "@/lib/applications/get-applications";

const EVENT_LABEL: Record<ApplicationEvent["type"], (e: ApplicationEvent) => string> = {
  postulacion_creada: () => "Postulación recibida",
  etapa_cambiada: () => "Cambió de etapa",
  nota_agregada: (e) => (e.payload.is_private ? "Agregó una nota privada" : "Agregó una nota"),
  correo_enviado: () => "Se envió un correo",
  adjunto_agregado: () => "Se agregó un adjunto",
  calificacion_cambiada: (e) => `Calificación: ${e.payload.rating ?? "sin calificar"}`,
  rechazada: () => "Postulación rechazada",
};

export function ApplicationTimeline({ events }: { events: ApplicationEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Sin actividad todavía.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {events.map((e) => (
        <li key={e.id} className="border-l-2 border-border pl-3 text-sm">
          <p>{EVENT_LABEL[e.type](e)}</p>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {e.actorName ?? "Sistema"} · {new Date(e.createdAt).toLocaleString("es-GT")}
          </p>
        </li>
      ))}
    </ol>
  );
}
```

(`new Date(...).toLocaleString()` aquí es seguro en un Server Component sin el problema de reloj de Fase 3 — `e.createdAt` es un timestamp fijo del evento, no "ahora"; no cambia entre servidor y cliente porque no depende del reloj de quien renderiza, solo del dato guardado.)

- [ ] **Paso 4: Escribir `note-form.tsx`** (mismo patrón `useActionState` + `<ActionButton>` que `refer-candidate-dialog.tsx`) y `note-list.tsx` (lista simple, nota privada con un badge `Privada`).

- [ ] **Paso 5: Escribir `rating-stars.tsx`** — 5 botones tipo estrella, `useTransition` + `setRating`, mismo patrón que `user-row.tsx`.

- [ ] **Paso 6: Escribir `reject-dialog.tsx`** — diálogo nativo (mismo patrón que `refer-candidate-dialog.tsx`) con un `<select>` de motivos (recibe la lista de `rejection_reasons` como prop, cargada por la página) y `useActionState(rejectApplication.bind(null, applicationId), undefined)`.

- [ ] **Paso 7: Escribir `hire-button.tsx`** — `<ActionButton>` con `useTransition`, sin diálogo de confirmación extra (contratar no es una eliminación; una confirmación aquí sería fricción sin la regla de AGENTS.md exigiéndola — solo eliminar exige `<ConfirmDialog>`).

- [ ] **Paso 8: Escribir `[applicationId]/page.tsx`.**

```tsx
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getApplicationDetail } from "@/lib/applications/get-applications";
import { CvLink } from "@/components/postulaciones/cv-link";
import { ApplicationTimeline } from "@/components/postulaciones/application-timeline";
import { NoteForm } from "@/components/postulaciones/note-form";
import { NoteList } from "@/components/postulaciones/note-list";
import { RatingStars } from "@/components/postulaciones/rating-stars";
import { RejectDialog } from "@/components/postulaciones/reject-dialog";
import { HireButton } from "@/components/postulaciones/hire-button";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const profile = await requireProfile();
  const application = await getApplicationDetail(applicationId);
  if (!application) notFound();

  const supabase = await createClient();
  const { data: reasons } = await supabase.from("rejection_reasons").select("id, label").eq("is_active", true);

  return (
    <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[1fr_320px]">
      <div>
        <p className="text-xs text-muted-foreground">{application.jobTitle} · {application.stageName}</p>
        <h1 className="font-serif mt-1.5 text-[32px]">{application.candidateName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {application.candidateEmail} · {application.candidatePhone ?? "sin teléfono"}
        </p>

        <div className="mt-6">
          <CvLink cvFilePath={application.cvFilePath} />
        </div>

        {application.status !== "activa" && (
          <p className="mt-4 text-sm">
            Estado: <strong>{application.status}</strong>
            {application.rejectionReasonLabel && ` — ${application.rejectionReasonLabel}`}
          </p>
        )}

        {application.status === "activa" && profile.role !== "colaborador" && (
          <div className="mt-6 flex items-center gap-3">
            <HireButton applicationId={application.id} />
            <RejectDialog applicationId={application.id} reasons={reasons ?? []} />
          </div>
        )}

        <section className="mt-10">
          <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Notas</h2>
          <div className="mt-3">
            <NoteForm applicationId={application.id} />
          </div>
          <div className="mt-5">
            <NoteList notes={application.notes} />
          </div>
        </section>
      </div>

      <div>
        <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Calificación</h2>
        <div className="mt-3">
          <RatingStars applicationId={application.id} rating={application.rating} />
        </div>

        <h2 className="mt-8 text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Actividad</h2>
        <div className="mt-3">
          <ApplicationTimeline events={application.events} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Paso 9: `loading.tsx` con skeletons del layout de dos columnas.**

- [ ] **Paso 10: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 11: Commit.**

```bash
git add src/lib/applications/schema.ts src/lib/applications/actions.ts src/components/postulaciones "src/app/(app)/postulaciones"
git commit -m "feat(postulaciones): detalle con timeline, notas, calificación, rechazo y contratación"
```

**Checkpoint B:** detalle de postulación completo — CV, timeline, notas (con privacidad), calificación, rechazar/reabrir/contratar, todo de punta a punta.

---

## Tarea 6 — Lista de postulaciones con filtros + nav

**Files:**
- Create: `src/app/(app)/candidatos/page.tsx`
- Create: `src/app/(app)/candidatos/loading.tsx`
- Modify: `src/components/layout/floating-nav.tsx`
- Modify: `src/app/(app)/vacantes/[id]/page.tsx`

- [ ] **Paso 1: Escribir `/candidatos/page.tsx`** — lista a nivel de postulación (candidato + vacante + etapa + estado), con filtros por `searchParams` (`q` para nombre/email, `job` para vacante, `stage_type` para tipo de etapa). RLS de `applications_select` ya filtra qué ve cada rol; el filtro de la URL solo acota más, nunca menos.

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/dal";

export default async function CandidatosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireProfile();
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("applications")
    .select("id, status, jobs(title), job_stages(name), candidates(full_name, email)")
    .order("applied_at", { ascending: false })
    .limit(50);

  if (q) {
    // ilike SÍ es correcto aquí: es búsqueda de texto libre para un humano,
    // no una clave de deduplicación (ver napkin, punto 3 de Fase 4) — el
    // filtro se aplica sobre candidates, así que hay que traer el id
    // primero si Supabase no permite filtrar por columna de una relación
    // embebida directamente; confirmar contra la versión real de
    // postgrest-js al implementar, y si no se puede en un solo query,
    // resolver los candidate_id que matchean en una consulta aparte.
  }

  const { data: applications } = await query;

  return (
    <div>
      <h1 className="font-serif text-[32px]">Candidatos</h1>
      <form className="mt-6">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre o correo"
          className="h-10 w-72 rounded-md border border-border bg-background px-3 text-sm"
        />
      </form>
      <div className="mt-6 grid gap-2">
        {(applications ?? []).map((a) => (
          <Link
            key={a.id}
            href={`/postulaciones/${a.id}`}
            className="flex items-center justify-between border border-border bg-card px-4 py-3 text-sm hover:border-foreground/30"
          >
            <span>{a.candidates?.full_name}</span>
            <span className="text-muted-foreground">
              {a.jobs?.title} · {a.job_stages?.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

El paso de búsqueda por texto (`q`) queda anotado explícitamente como decisión a resolver en el momento de implementar contra la versión real de `@supabase/supabase-js` instalada (`.select()` con filtro sobre columna de tabla embebida vía `!inner` es la forma estándar — `.eq("candidates.full_name", ...)` no filtra embebidas por defecto, hace falta `candidates!inner(full_name.ilike.%...%)` o una subconsulta). No es un placeholder de pereza: es una API cuyo comportamiento exacto hay que confirmar contra la versión instalada en `package.json`, no inventarlo de memoria — mismo criterio que motivó el "confirmar antes de asumir" de Fase 4.

- [ ] **Paso 2: Resolver la búsqueda por texto contra la API real.** Probar en el propio código (no hace falta un entorno de ejecución completo — el tipo lo valida `tsc`, y la sintaxis de filtro sobre relación embebida de PostgREST/`supabase-js` es: `.select("*, candidates!inner(full_name, email)").or(\`full_name.ilike.%${q}%,email.ilike.%${q}%\`, { referencedTable: "candidates" })`. Ajustar según lo que `npm run build` acepte.

- [ ] **Paso 3: `loading.tsx` con skeletons de filas.**

- [ ] **Paso 4: Agregar "Candidatos" al nav** (admin+/gestor, no colaborador — un colaborador refiere pero no gestiona el pipeline de candidatos):

```ts
import { Briefcase, Home, Settings, Users } from "lucide-react";
// ...
function itemsForRole(role: Role): NavItem[] {
  const base: NavItem[] = [
    { href: "/inicio", label: "Inicio", icon: Home },
    { href: "/vacantes", label: "Vacantes", icon: Briefcase },
  ];
  if (role === "gestor" || ADMIN_ROLES.has(role)) {
    base.push({ href: "/candidatos", label: "Candidatos", icon: Users });
  }
  if (ADMIN_ROLES.has(role)) {
    base.push({ href: "/configuracion", label: "Ajustes", icon: Settings });
  }
  return base;
}
```

(Con esto quedan hasta 4 ítems para admin+ — sigue bajo el máximo de 5.)

- [ ] **Paso 5: Agregar el enlace "Ver pipeline" en `[id]/page.tsx`** (detalle de vacante), visible cuando `job.status` no es `borrador` ni `pendiente_aprobacion` (antes de eso no hay nada que mostrar en el kanban):

```tsx
{!["borrador", "pendiente_aprobacion"].includes(job.status) && (
  <Link href={`/vacantes/${job.id}/pipeline`} className="text-sm font-medium text-accent underline">
    Ver pipeline
  </Link>
)}
```

- [ ] **Paso 6: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 7: Commit.**

```bash
git add "src/app/(app)/candidatos" src/components/layout/floating-nav.tsx "src/app/(app)/vacantes/[id]/page.tsx"
git commit -m "feat(candidatos): lista con búsqueda + enlaces de navegación al pipeline"
```

---

## Tarea 7 — Limpieza de datos de prueba, revisión final y cierre de fase

- [ ] **Paso 1: Borrar los datos de prueba sembrados en la Tarea 1** (vacante/candidatos/postulaciones de prueba) vía SQL — la base de producción del usuario no debe quedar con filas falsas.

- [ ] **Paso 2: Correr `/code-review --high` sobre todo el diff de la fase y resolver cada hallazgo real hasta converger** — mismo criterio que Fases 3/4 (verificar contra la base real con SQL antes de aceptar un hallazgo sobre RLS, no implementar a ciegas).

- [ ] **Paso 3: Actualizar `.claude/napkin.md`** con cualquier trampa nueva (sintaxis real de filtro sobre relación embebida en `@supabase/supabase-js`, nombres reales de las relaciones embebidas si difirieron de lo asumido, cualquier ajuste al rango de `rating`).

- [ ] **Paso 4: Actualizar `docs/database.md`** solo si Tarea 1 encontró un gap real que requirió una migración (ej. un `CHECK` en `rating`).

- [ ] **Paso 5: Actualizar la tabla "Estado del proyecto" de `README.md`** — Fase 5 pasa a ✅.

- [ ] **Paso 6: Push de cierre de fase.**

```bash
git push -u origin claude/ats-platform-design-8ve51p
```

---

## Self-Review

- **Cobertura del alcance:** kanban con drag-and-drop (Tarea 3) ✓, perfil de candidato vía detalle de postulación con CV firmado y timeline (Tareas 4-5) ✓, notas con privacidad (Tarea 5) ✓, calificación (Tarea 5) ✓, rechazo con motivo + contratación (Tarea 5) ✓, búsqueda con filtros (Tarea 6) ✓. Recorte documentado arriba ("Alcance recortado a propósito"): sin página de perfil agregado multi-vacante, sin evento de tipo "contratada" (no existe en el enum).
- **Placeholders:** el filtro de búsqueda por texto en Tarea 6 queda explícitamente marcado como "resolver contra la API real de la versión instalada" en vez de inventar la sintaxis — no es pereza, es la misma disciplina de "verificar, no asumir" que motivó toda esta fase (el bug de la ruta de Storage se encontró exactamente por asumir en vez de verificar).
- **Consistencia de tipos:** `ApplicationActionResult` se define una vez (Tarea 3) y se reusa en Tarea 5 sin redefinir. `KanbanCard`/`ApplicationDetail`/`ApplicationEvent`/`ApplicationNote` se definen una vez en Tarea 2 y los componentes de Tareas 3-6 los importan, no los redeclaran.
