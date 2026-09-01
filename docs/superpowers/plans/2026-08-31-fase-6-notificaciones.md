# Fase 6 — Notificaciones in-app y correo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un helper único `notify()` que registra la notificación in-app y dispara el correo por Resend según preferencia del destinatario; campana en el header con Realtime; centro de notificaciones; preferencias por tipo; plantillas de React Email para los eventos ya construidos en Fases 4-5.

**Architecture:** `notify()` vive en el servidor y SIEMPRE usa el cliente admin para el insert (no hay política de INSERT en `notifications` para `authenticated` — deny-by-default real, no un descuido). La lectura/actualización de las propias notificaciones sí usa el cliente de sesión (RLS ya las filtra por `recipient_id = auth.uid()`). El correo al candidato ("postulación recibida") es un envío directo con Resend desde el Route Handler público, sin pasar por `notify()` ni por `notifications` — un candidato no tiene fila en `profiles`, así que no hay a quién apuntar `recipient_id`.

**Tech Stack:** Next.js 16 Server Actions, Supabase Realtime (Postgres Changes), Resend + React Email, Zod v4.

**Spec:** `/root/.claude/plans/quiero-que-usemos-este-ethereal-acorn.md` (sección "Fase 6"); `.claude/napkin.md` secciones de Fases 4-5 (mismos hallazgos de RLS/cliente admin aplican aquí).

## Alcance recortado a propósito

- **`mencion_nota` NO se cablea en esta fase.** Fase 5 nunca construyó un selector de @mención en `NoteForm` — la columna `notes.mentions` existe pero nada la llena. No tiene sentido escribir el disparador de una notificación para un evento que nunca ocurre. Queda anotado en el napkin como dependencia: cuando `NoteForm` gane un selector de menciones, cablear `notify()` con `type: "mencion_nota"` ahí — la plantilla de correo y el tipo de notificación quedan listos desde esta fase, solo falta el punto de origen.
- **`respuesta_reporte_error`** es de Fase 7 (Centro de errores) — no se toca aquí, aunque el enum `notification_type` ya lo incluya.

## Global Constraints

(Mismas que Fases 4-5, repetidas por completitud)
- Todo el texto de interfaz en español, cero inglés — incluidos los correos.
- Todo botón que muta datos usa `<ActionButton>`; toda mutación exitosa llama `notifySuccess(...)`.
- Skeletons en cada `loading.tsx` nuevo.
- Zod en cada Server Action.
- **Antes de escribir una query nueva contra una tabla, confirmar la política RLS real con SQL — no asumir.** (Ya hecho para esta fase, ver "Hallazgos" abajo.)
- Toda operación que necesite una verdad de la organización más allá de lo que el actor ve por RLS usa `createAdminClient()`.
- `RESEND_API_KEY` y `SUPABASE_SERVICE_ROLE_KEY` nunca en un client component, nunca con prefijo `NEXT_PUBLIC_`.

## Hallazgos de esquema/RLS ya confirmados

- **`notifications` no tiene política de INSERT para `authenticated`** — solo `notifications_select_own`, `notifications_update_own`, `notifications_delete_own`, todas `recipient_id = auth.uid()`. Insertar una notificación (casi siempre para OTRO usuario, no para uno mismo) **requiere el cliente admin**, no es opcional.
- **`notification_preferences_own`** (`ALL`, `profile_id = auth.uid()`): cada quien lee/escribe solo sus propias preferencias. `notify()` mismo consulta esta tabla con el cliente admin (necesita leer la preferencia del DESTINATARIO, no la del actor que disparó el evento).
- **Sin fila en `notification_preferences` para un (profile_id, type) dado → tratar como habilitado** (`in_app=true, email=true` son los defaults de columna; no hay una fila sembrada por usuario/tipo, así que "no existe" y "está en true" son el mismo caso en la práctica).
- **`notifications.recipient_id` referencia `profiles(id)`** — un candidato (tabla `candidates`, sin fila en `profiles`) nunca puede ser destinatario de una notificación in-app. El correo de "postulación recibida" es un envío directo, no pasa por esta tabla.
- **`email_templates`** es de escritura admin-only, lectura no confirmada como necesaria en código — Fase 6 no la usa: las plantillas viven como componentes de React Email en `emails/`, no en la base (la tabla es para que un admin edite el texto desde la UI en una fase futura; no se construye esa UI ahora — YAGNI, no está en el alcance pedido).
- **Realtime: `notifications` NO está en la publicación `supabase_realtime`** (`select * from pg_publication_tables where pubname='supabase_realtime'` devolvió vacío — ninguna tabla del proyecto tiene Realtime habilitado todavía). Hace falta una migración `alter publication supabase_realtime add table notifications;` antes de que cualquier suscripción del cliente reciba algo.
- **`RESEND_API_KEY` y `EMAIL_FROM` ya existen en `.env.local`** — no hace falta pedirle al usuario que los configure como paso manual (a diferencia del hook JWT y el proveedor de Google en Fase 3). El envío real no se puede probar desde este sandbox (sin salida a internet real, mismo límite ya documentado en el napkin) — se verifica por inspección de código + build, y el envío real se confirma en Vercel.

## Mapa de archivos

**Núcleo de notificaciones:**
- `src/lib/notifications/notify.ts` — `notify()`, el único punto de entrada para crear una notificación in-app + disparar su correo.
- `src/lib/notifications/get-notifications.ts` — `getUnreadCount()`, `getRecentNotifications()`, `getAllNotifications()`.
- `src/lib/notifications/mark-read-actions.ts` — `markAsRead`, `markAllAsRead`.
- `src/lib/notifications/preferences-actions.ts` — `updatePreference`.
- `src/lib/notifications/preferences-schema.ts` — tipos/labels de los 5 tipos de notificación que sí se usan en esta fase (se excluye `mencion_nota`/`respuesta_reporte_error` de la UI de preferencias hasta que existan).

**Correo:**
- `src/lib/email/send-email.ts` — `sendEmail({ to, subject, react })`, wrapper delgado sobre Resend.
- `emails/components/email-layout.tsx` — layout compartido (logo/nombre de la organización, pie de página) para no repetirlo en cada plantilla.
- `emails/nueva-postulacion.tsx`, `emails/cambio-etapa.tsx`, `emails/vacante-pendiente-aprobacion.tsx`, `emails/movimiento-referido.tsx`, `emails/postulacion-recibida.tsx`.

**UI:**
- `src/components/layout/notification-bell.tsx` (cliente, Realtime) + `notification-item.tsx`.
- `src/app/(app)/notificaciones/page.tsx` + `loading.tsx`.
- `src/app/(app)/mi-cuenta/page.tsx` + `loading.tsx` — preferencias personales.
- Modificar `src/components/layout/app-header.tsx` para montar `<NotificationBell>`.
- Modificar `src/app/(app)/layout.tsx` para pasarle `profile.id`/`profile.email` al header si hace falta.

**Puntos de disparo (modificar Server Actions ya existentes):**
- `src/lib/jobs/actions.ts` — `submitForApproval` dispara `vacante_pendiente_aprobacion` a los admin+ de la organización.
- `src/lib/jobs/actions.ts` — `referCandidate` dispara `nueva_postulacion` al dueño/solicitante de la vacante.
- `src/app/api/postular/route.ts` — dispara `nueva_postulacion` (mismo destinatario) + envía el correo de "postulación recibida" al candidato.
- `src/lib/applications/actions.ts` — `moveApplicationStage` dispara `cambio_etapa` al dueño/solicitante (si quien mueve es alguien distinto) y `movimiento_referido` a quien refirió al candidato (si aplica).

## Interfaces clave

```ts
// src/lib/notifications/notify.ts
import type { Database } from "@/lib/supabase/database.types";
type NotificationType = Database["public"]["Enums"]["notification_type"];

export type NotifyInput = {
  organizationId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  entityType?: string;
  entityId?: string;
  email?: { subject: string; react: React.ReactElement };
};

export async function notify(input: NotifyInput): Promise<void>;
```

```ts
// src/lib/notifications/get-notifications.ts
export type NotificationItem = {
  id: string;
  type: Database["public"]["Enums"]["notification_type"];
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
};
export async function getUnreadCount(): Promise<number>;
export async function getRecentNotifications(limit?: number): Promise<NotificationItem[]>;
export async function getAllNotifications(): Promise<NotificationItem[]>;
```

```ts
// src/lib/email/send-email.ts
export async function sendEmail(input: { to: string; subject: string; react: React.ReactElement }): Promise<{ error?: string }>;
```

---

## Tarea 1 — Migración de Realtime + `sendEmail` + `notify()`

**Files:**
- Migración vía MCP (`31_enable_realtime_notifications`).
- Create: `src/lib/email/send-email.ts`
- Create: `src/lib/notifications/notify.ts`

**Interfaces:** produce `sendEmail()` y `notify()`, consumidos por todas las tareas siguientes.

- [ ] **Paso 1: Aplicar la migración de Realtime.**

```sql
alter publication supabase_realtime add table notifications;
```

- [ ] **Paso 2: Escribir `send-email.ts`.**

```ts
import "server-only";
import { Resend } from "resend";
import type { ReactElement } from "react";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(input: {
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<{ error?: string }> {
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: input.to,
    subject: input.subject,
    react: input.react,
  });
  if (error) return { error: "No se pudo enviar el correo." };
  return {};
}
```

- [ ] **Paso 3: Escribir `notify()`.**

```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import type { Database } from "@/lib/supabase/database.types";
import type { ReactElement } from "react";

type NotificationType = Database["public"]["Enums"]["notification_type"];

export type NotifyInput = {
  organizationId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  entityType?: string;
  entityId?: string;
  email?: { subject: string; react: ReactElement };
};

/**
 * Único punto de entrada para notificar a un usuario interno. SIEMPRE usa
 * el cliente admin: notifications no tiene política de INSERT para
 * `authenticated` (no es un descuido — casi nunca se notifica a uno mismo,
 * así que RLS lo niega por diseño) y aquí hay que leer la preferencia del
 * DESTINATARIO, no la del actor que disparó el evento.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const admin = createAdminClient();

  const { data: preference } = await admin
    .from("notification_preferences")
    .select("in_app, email")
    .eq("profile_id", input.recipientId)
    .eq("type", input.type)
    .maybeSingle();

  // Sin fila = tratado como habilitado (son los defaults de columna).
  const inAppEnabled = preference?.in_app ?? true;
  const emailEnabled = preference?.email ?? true;

  if (inAppEnabled) {
    await admin.from("notifications").insert({
      organization_id: input.organizationId,
      recipient_id: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body,
      url: input.url ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
    });
  }

  if (emailEnabled && input.email) {
    const { data: recipient } = await admin
      .from("profiles")
      .select("email")
      .eq("id", input.recipientId)
      .single();
    if (recipient) {
      await sendEmail({ to: recipient.email, subject: input.email.subject, react: input.email.react });
      // Marcar email_sent_at es un nice-to-have, no crítico — se omite para
      // no complicar la primera versión: no hay UI que lo muestre todavía.
    }
  }
}
```

- [ ] **Paso 4: `npm run typecheck && npm run lint`.**

- [ ] **Paso 5: Commit.**

```bash
git add src/lib/email/send-email.ts src/lib/notifications/notify.ts
git commit -m "feat(notificaciones): helper notify() + envío de correo con Resend"
```

---

## Tarea 2 — Lectura, marcar como leído, campana con Realtime

**Files:**
- Create: `src/lib/notifications/get-notifications.ts`
- Create: `src/lib/notifications/mark-read-actions.ts`
- Create: `src/components/layout/notification-item.tsx`
- Create: `src/components/layout/notification-bell.tsx`
- Modify: `src/components/layout/app-header.tsx`
- Modify: `src/app/(app)/layout.tsx` (pasar `profile.id` si el `Pick<...>` actual de `AppHeader` no lo incluye)

- [ ] **Paso 1: Escribir `get-notifications.ts`.**

```ts
import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type NotificationItem = {
  id: string;
  type: Database["public"]["Enums"]["notification_type"];
  title: string;
  body: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
};

function mapRow(r: {
  id: string;
  type: Database["public"]["Enums"]["notification_type"];
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
}): NotificationItem {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    url: r.url,
    readAt: r.read_at,
    createdAt: r.created_at,
  };
}

export async function getUnreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  return count ?? 0;
}

export async function getRecentNotifications(limit = 8): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, url, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapRow);
}

export async function getAllNotifications(): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, title, body, url, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []).map(mapRow);
}
```

- [ ] **Paso 2: Escribir `mark-read-actions.ts`.**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export async function markAsRead(notificationId: string): Promise<void> {
  await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null);
  revalidatePath("/notificaciones");
}

export async function markAllAsRead(): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", profile.id)
    .is("read_at", null);
  revalidatePath("/notificaciones");
}
```

(`markAsRead`/`markAllAsRead` no necesitan filtrar por `recipient_id` en el `UPDATE` de `markAsRead` porque RLS ya lo exige — pero `markAllAsRead` SÍ necesita `.eq("recipient_id", profile.id)` porque sin ningún filtro de igualdad además de `read_at is null`, actualizaría "todas las no leídas que RLS deja ver", que ya son solo las propias — el filtro extra es defensivo, no estrictamente necesario, pero es el mismo estilo defensivo usado en Fases 4-5.)

- [ ] **Paso 3: Escribir `notification-item.tsx`** — fila con punto de "no leída" (un círculo pequeño con `bg-accent` si `!readAt`), título, cuerpo truncado, tiempo relativo simple (`Intl.RelativeTimeFormat` o una función a mano — no agregar una librería nueva por esto), envuelta en un `<Link>` a `url` si existe, que además llama `markAsRead` en el `onClick` (cliente, `startTransition`).

- [ ] **Paso 4: Escribir `notification-bell.tsx`.**

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NotificationItem } from "./notification-item";
import type { NotificationItem as NotificationItemType } from "@/lib/notifications/get-notifications";

export function NotificationBell({
  profileId,
  initialItems,
  initialUnreadCount,
}: {
  profileId: string;
  initialItems: NotificationItemType[];
  initialUnreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${profileId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            type: NotificationItemType["type"];
            title: string;
            body: string;
            url: string | null;
            read_at: string | null;
            created_at: string;
          };
          setItems((current) => [
            {
              id: row.id,
              type: row.type,
              title: row.title,
              body: row.body,
              url: row.url,
              readAt: row.read_at,
              createdAt: row.created_at,
            },
            ...current,
          ].slice(0, 8));
          setUnreadCount((count) => count + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  function handleItemRead(id: string) {
    setItems((current) => current.map((i) => (i.id === id && !i.readAt ? { ...i, readAt: new Date().toISOString() } : i)));
    setUnreadCount((count) => Math.max(0, count - 1));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground"
      >
        <Bell className="size-4" aria-hidden />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-accent-foreground tabular-nums">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 border border-border bg-card shadow-none">
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Sin notificaciones todavía.</p>
            ) : (
              items.map((item) => (
                <NotificationItem key={item.id} item={item} onRead={() => handleItemRead(item.id)} />
              ))
            )}
          </div>
          <a href="/notificaciones" className="block border-t border-border p-3 text-center text-xs text-accent underline">
            Ver todas
          </a>
        </div>
      )}
    </div>
  );
}
```

(La caja del desplegable no usa sombra difusa — borde de 1px, consistente con la regla de "editorial sobrio". Cerrar al hacer clic afuera queda fuera de esta tarea si el tiempo aprieta — no es un requisito explícito del alcance, es un nice-to-have; si sobra tiempo, agregar un listener de `mousedown` en el documento.)

- [ ] **Paso 5: Modificar `app-header.tsx`** para recibir `profileId: string`, `initialNotifications: NotificationItemType[]`, `initialUnreadCount: number` y montar `<NotificationBell>` junto al resto de la barra derecha.

- [ ] **Paso 6: Modificar `(app)/layout.tsx`** para llamar `getRecentNotifications()`/`getUnreadCount()` (en paralelo con `Promise.all`, junto a `requireProfile()`/`getOrganization()` que ya están ahí) y pasarlos a `AppHeader`.

- [ ] **Paso 7: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 8: Commit.**

```bash
git add src/lib/notifications/get-notifications.ts src/lib/notifications/mark-read-actions.ts src/components/layout/notification-item.tsx src/components/layout/notification-bell.tsx src/components/layout/app-header.tsx "src/app/(app)/layout.tsx"
git commit -m "feat(notificaciones): campana con Realtime en el header"
```

**Checkpoint A:** la campana existe, muestra el conteo de no leídas, lista las recientes, y (por inspección de código contra la API documentada de Supabase Realtime — no se puede probar en vivo desde este sandbox) se actualiza sola cuando llega una fila nueva.

---

## Tarea 3 — Centro de notificaciones (`/notificaciones`)

**Files:**
- Create: `src/app/(app)/notificaciones/page.tsx`
- Create: `src/app/(app)/notificaciones/loading.tsx`

- [ ] **Paso 1: Escribir la página** — lista completa (`getAllNotifications()`), botón "Marcar todas como leídas" (`<ActionButton>` + `useTransition` + `markAllAsRead`), cada fila reusa `<NotificationItem>` de la Tarea 2.

- [ ] **Paso 2: `loading.tsx` con skeletons de filas.**

- [ ] **Paso 3: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 4: Commit.**

```bash
git add "src/app/(app)/notificaciones"
git commit -m "feat(notificaciones): centro de notificaciones completo"
```

---

## Tarea 4 — Preferencias personales (`/mi-cuenta`)

**Files:**
- Create: `src/lib/notifications/preferences-schema.ts`
- Create: `src/lib/notifications/preferences-actions.ts`
- Create: `src/app/(app)/mi-cuenta/page.tsx`
- Create: `src/app/(app)/mi-cuenta/loading.tsx`
- Create: `src/components/notificaciones/preference-row.tsx`

- [ ] **Paso 1: Escribir `preferences-schema.ts`** — los 5 tipos que sí se usan en esta fase (excluye `mencion_nota`/`respuesta_reporte_error`, sin punto de origen todavía):

```ts
import type { Database } from "@/lib/supabase/database.types";

type NotificationType = Database["public"]["Enums"]["notification_type"];

export const PREFERENCE_TYPES: NotificationType[] = [
  "nueva_postulacion",
  "cambio_etapa",
  "vacante_pendiente_aprobacion",
  "movimiento_referido",
];

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  nueva_postulacion: "Nueva postulación en tus vacantes",
  cambio_etapa: "Cambios de etapa en tus vacantes",
  mencion_nota: "Menciones en notas",
  vacante_pendiente_aprobacion: "Vacantes pendientes de aprobación",
  movimiento_referido: "Movimientos de tus referidos",
  respuesta_reporte_error: "Respuestas del soporte",
};
```

- [ ] **Paso 2: Escribir `preferences-actions.ts`.**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type NotificationType = Database["public"]["Enums"]["notification_type"];
const ChannelSchema = z.enum(["in_app", "email"]);

export async function updatePreference(
  type: NotificationType,
  channel: "in_app" | "email",
  enabled: boolean,
): Promise<{ error?: string }> {
  const profile = await requireProfile();
  const parsedChannel = ChannelSchema.safeParse(channel);
  if (!parsedChannel.success) return { error: "Canal inválido." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notification_preferences")
    .upsert(
      { profile_id: profile.id, type, [parsedChannel.data]: enabled },
      { onConflict: "profile_id,type" },
    );

  if (error) return { error: "No se pudo guardar la preferencia." };
  revalidatePath("/mi-cuenta");
  return {};
}
```

(Confirmar en el Paso 3 de esta tarea si `notification_preferences` tiene una restricción `UNIQUE(profile_id, type)` real para que `onConflict` funcione — si no existe, agregarla en una migración antes de seguir: sin un `UNIQUE`, el `upsert` no tiene sobre qué columnas resolver el conflicto y falla o duplica filas.)

- [ ] **Paso 3: Verificar el `UNIQUE` antes de dar el paso 2 por bueno.**

```sql
select conname, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'notification_preferences'::regclass and contype = 'u';
```

Si no aparece `UNIQUE(profile_id, type)`, aplicar:

```sql
alter table notification_preferences add constraint notification_preferences_profile_type_key unique (profile_id, type);
```

- [ ] **Paso 4: Escribir `preference-row.tsx`** (cliente) — una fila por tipo con dos checkboxes ("In-app", "Correo"), cada uno dispara `updatePreference` con `useTransition` al cambiar, sin botón de guardar aparte (autoguardado, como un toggle).

- [ ] **Paso 5: Escribir `/mi-cuenta/page.tsx`** — trae las preferencias existentes del usuario (`notification_preferences` filtrado por `profile_id`), arma un mapa `type -> {in_app, email}` con default `true` para los tipos sin fila, y renderiza una fila por cada `PREFERENCE_TYPES`.

- [ ] **Paso 6: `loading.tsx` con skeletons de filas.**

- [ ] **Paso 7: Agregar un enlace a "Mi cuenta" desde algún lugar accesible** — el menú flotante ya tiene máximo de ítems ocupado; usar el mismo patrón que Fase 3 hizo para acciones secundarias: un enlace desde el header (junto al nombre del usuario) en vez de ocupar un quinto ítem del nav.

- [ ] **Paso 8: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 9: Commit.**

```bash
git add src/lib/notifications/preferences-schema.ts src/lib/notifications/preferences-actions.ts "src/app/(app)/mi-cuenta" src/components/notificaciones/preference-row.tsx src/components/layout/app-header.tsx
git commit -m "feat(notificaciones): preferencias personales por tipo y canal"
```

**Checkpoint B:** el sistema de notificaciones in-app está completo y autocontenido — falta cablear los disparadores reales (Tarea 5) y las plantillas de correo (Tarea 6).

---

## Tarea 5 — Plantillas de React Email

**Files:**
- Create: `emails/components/email-layout.tsx`
- Create: `emails/nueva-postulacion.tsx`
- Create: `emails/cambio-etapa.tsx`
- Create: `emails/vacante-pendiente-aprobacion.tsx`
- Create: `emails/movimiento-referido.tsx`
- Create: `emails/postulacion-recibida.tsx`

- [ ] **Paso 1: Escribir `email-layout.tsx`** — envoltura compartida con `@react-email/components` (`Html`, `Head`, `Body`, `Container`, `Text`), estética consistente con "editorial sobrio" dentro de lo que un cliente de correo permite (tipografía sans, fondo claro, un enlace de acento):

```tsx
import { Html, Head, Body, Container, Text, Section } from "@react-email/components";

export function EmailLayout({ platformName, children }: { platformName: string; children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#faf9f7", fontFamily: "sans-serif", margin: 0, padding: "32px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", border: "1px solid #e4e1da", padding: "32px", maxWidth: 480 }}>
          <Text style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b6862" }}>
            {platformName}
          </Text>
          <Section style={{ marginTop: 16 }}>{children}</Section>
        </Container>
      </Body>
    </Html>
  );
}
```

- [ ] **Paso 2: Escribir las 5 plantillas restantes**, cada una un componente que recibe los datos ya resueltos como props (nunca hace su propia consulta a la base — las plantillas son puramente de presentación) y usa `<EmailLayout>`. Ejemplo completo de una (las demás siguen el mismo patrón con su propio texto):

```tsx
// emails/nueva-postulacion.tsx
import { Text, Link } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

export function NuevaPostulacionEmail({
  platformName,
  candidateName,
  jobTitle,
  applicationUrl,
}: {
  platformName: string;
  candidateName: string;
  jobTitle: string;
  applicationUrl: string;
}) {
  return (
    <EmailLayout platformName={platformName}>
      <Text style={{ fontSize: 20, fontWeight: 600 }}>Nueva postulación</Text>
      <Text>
        {candidateName} acaba de postular a <strong>{jobTitle}</strong>.
      </Text>
      <Link href={applicationUrl} style={{ color: "#1f4d3d" }}>
        Ver la postulación
      </Link>
    </EmailLayout>
  );
}
```

Las otras cuatro (`CambioEtapaEmail`, `VacantePendienteAprobacionEmail`, `MovimientoReferidoEmail`, `PostulacionRecibidaEmail`) siguen el mismo molde — título corto, una frase con los datos relevantes, un enlace de acción. `PostulacionRecibidaEmail` es la única sin enlace a la app (el candidato no tiene cuenta): solo confirma que se recibió la postulación y qué sigue.

- [ ] **Paso 3: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 4: Commit.**

```bash
git add emails
git commit -m "feat(correo): plantillas de React Email para los eventos de Fases 4-5"
```

---

## Tarea 6 — Cablear los disparadores reales

**Files:**
- Modify: `src/lib/jobs/actions.ts` (`submitForApproval`, `referCandidate`)
- Modify: `src/app/api/postular/route.ts`
- Modify: `src/lib/applications/actions.ts` (`moveApplicationStage`)

- [ ] **Paso 1: `submitForApproval` → `vacante_pendiente_aprobacion` a los admin+ de la organización.**

```ts
import { notify } from "@/lib/notifications/notify";
import { getSiteUrl } from "@/lib/site-url";
import { VacantePendienteAprobacionEmail } from "../../../emails/vacante-pendiente-aprobacion";
// (ajustar la ruta relativa real a emails/ desde src/lib/jobs/actions.ts al implementar)

export async function submitForApproval(jobId: string): Promise<JobActionResult> {
  const result = await transitionJob(jobId, "pendiente_aprobacion", ownerOrAdmin("..."));
  if (result.error) return result;

  const supabase = await createClient();
  const [{ data: job }, { data: admins }] = await Promise.all([
    supabase.from("jobs").select("title, organization_id").eq("id", jobId).single(),
    supabase.from("profiles").select("id, display_name").eq("role", "admin").eq("is_active", true),
    // super_admin también debería enterarse — agregar con un .or() o una segunda consulta si el tiempo lo permite;
    // no bloquear la tarea por esto, admin ya cubre el caso principal (RH opera el reclutamiento).
  ]);

  if (job) {
    const siteUrl = await getSiteUrl();
    await Promise.all(
      (admins ?? []).map((admin) =>
        notify({
          organizationId: job.organization_id,
          recipientId: admin.id,
          type: "vacante_pendiente_aprobacion",
          title: "Vacante pendiente de aprobación",
          body: `${job.title} está esperando tu revisión.`,
          url: `/vacantes/${jobId}`,
          entityType: "job",
          entityId: jobId,
          email: {
            subject: "Vacante pendiente de aprobación",
            react: VacantePendienteAprobacionEmail({ platformName: "Reclutamiento", jobTitle: job.title, jobUrl: `${siteUrl}/vacantes/${jobId}` }),
          },
        }),
      ),
    );
  }

  return result;
}
```

(El ejemplo usa `.eq("role", "admin")` nada más por brevedad — al implementar, decidir si conviene `.in("role", ["admin", "super_admin"])` para no dejar fuera al super admin. No es una decisión de negocio compleja, es un detalle de una línea a resolver en el momento sin bloquear la tarea por eso.)

- [ ] **Paso 2: `referCandidate` → `nueva_postulacion` al dueño/solicitante de la vacante** (después de que `createApplicationForCandidate` devuelva éxito, antes del `return` final). Mismo patrón: traer `jobs.title, owner_id, requested_by, organization_id`, notificar a `owner_id ?? requested_by` (el que exista) — pero no notificar al mismo actor que hizo la referencia (comparar contra `profile.id`, evita que alguien se autonotifique al referir a alguien en su propia vacante).

- [ ] **Paso 3: `/api/postular/route.ts`** — después de que el `Promise.all` de attachments/eventos termine, en paralelo (otro `Promise.all`, no secuencial):
  1. `notify()` al `owner_id ?? requested_by` de la vacante con `type: "nueva_postulacion"`.
  2. `sendEmail()` directo (sin `notify()`) al `email` del formulario con `PostulacionRecibidaEmail`.

Ambos son best-effort igual que attachments/application_events de esa misma ruta (un fallo aquí no debe convertir el 201 de éxito en un error — la postulación ya quedó registrada).

- [ ] **Paso 4: `moveApplicationStage` → `cambio_etapa` + `movimiento_referido`.** Después del insert de `application_events` que ya existe, en paralelo:
  1. Traer `jobs.title, owner_id, requested_by` de la vacante de esta postulación (ya se tiene `application.job_id` de la Tarea de validación cruzada de Fase 5) y `candidates.referred_by, full_name` del candidato.
  2. Si `owner_id ?? requested_by` existe y es distinto de `profile.id` (quien movió la tarjeta): `notify(type: "cambio_etapa")`.
  3. Si `candidates.referred_by` existe y es distinto de `profile.id`: `notify(type: "movimiento_referido")`.

- [ ] **Paso 5: `npm run typecheck && npm run lint && npm run build`.**

- [ ] **Paso 6: Verificación por inspección (no hay entorno para probar el envío real):** releer cada punto de disparo y confirmar que ningún `notify()`/`sendEmail()` bloquea el flujo principal si falla — todos deben ser best-effort, igual que los patrones ya establecidos en Fases 4-5 para `attachments`/`application_events`.

- [ ] **Paso 7: Commit.**

```bash
git add src/lib/jobs/actions.ts src/app/api/postular/route.ts src/lib/applications/actions.ts
git commit -m "feat(notificaciones): cablear los disparadores reales de Fases 4-5"
```

**Checkpoint C:** el sistema completo — al aprobar, postular, mover de etapa o referir, la notificación in-app y el correo correspondiente se disparan.

---

## Tarea 7 — Cierre de fase

- [ ] **Paso 1: Correr `/code-review --high` sobre todo el diff de la fase y resolver cada hallazgo real hasta converger.**
- [ ] **Paso 2: Actualizar `.claude/napkin.md`** — la dependencia pendiente de `mencion_nota`, el patrón de `notify()` con cliente admin, la migración de Realtime, y cualquier trampa nueva de Supabase Realtime/React Email encontrada al implementar.
- [ ] **Paso 3: Actualizar `docs/database.md`** con la migración de Realtime y el `UNIQUE` de `notification_preferences` si hizo falta agregarlo.
- [ ] **Paso 4: Actualizar `README.md`** — Fase 6 pasa a ✅.
- [ ] **Paso 5: Push de cierre de fase.**

```bash
git push -u origin claude/ats-platform-design-8ve51p
```

---

## Self-Review

- **Cobertura:** helper `notify()` ✓, campana con Realtime ✓, centro de notificaciones ✓, preferencias por tipo/canal ✓, plantillas de correo para los 5 eventos vigentes ✓, disparadores reales cableados en las 4 Server Actions/Route Handler que ya existían ✓. Recorte documentado: `mencion_nota` (sin punto de origen en el código todavía) y `respuesta_reporte_error` (Fase 7).
- **Placeholders:** las decisiones marcadas como "resolver al implementar sin bloquear la tarea" (si super_admin recibe `vacante_pendiente_aprobacion` además de admin) son detalles de una línea, no lógica de negocio nueva — la regla misma (RH aprueba vacantes) ya está definida en AGENTS.md.
- **Consistencia de tipos:** `NotifyInput`/`NotificationItem` se definen una vez y se reusan; `notify()` es la única función que inserta en `notifications`, ningún punto de disparo hace su propio `admin.from("notifications").insert(...)`.
