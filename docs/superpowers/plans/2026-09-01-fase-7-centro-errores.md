# Fase 7 — Centro de errores — Plan de implementación

> **Para quien ejecute:** usar `superpowers:executing-plans`. Cada tarea es un commit potencial, pero el push real se hace al cerrar toda la fase (regla de AGENTS.md).

**Objetivo:** cerrar el círculo de un error real: capturarlo con una tarjeta amigable, dejar que el usuario cuente en una frase qué intentaba hacer, crear un `error_reports` trazable, notificar al super admin, y sostener un hilo de conversación de ida y vuelta hasta resolverlo.

**Arquitectura:** todo el esquema (`error_reports`, `error_report_messages`, RLS) ya existe desde Fase 2 y ya se verificó contra la base real (ver napkin/plan de Fase 2). Fase 7 es pura capa de aplicación: un diálogo cliente que recolecta una pregunta + adjunta contexto técnico solo, una Server Action que inserta y notifica (reutilizando `notify()`/`notifyBestEffort()`/`getEmailContext()` de Fase 6), y dos superficies de lectura (bandeja del super admin, "Mis reportes" del usuario) sobre el mismo componente de hilo.

**Spec:** sección "Centro de errores (super admin)" y "Mensajes de error amigables" del plan maestro (`/root/.claude/plans/quiero-que-usemos-este-ethereal-acorn.md`), ya aprobado por el usuario.

## Restricciones verificadas contra la plataforma real (no asumir)

1. **RLS ya confirmada por SQL** (proyecto `cgudnnlcwcotovcslgzu`):
   - `error_reports_insert`: `with check (organization_id = auth_org_id() and reporter_id = auth.uid())` — un reporte SIEMPRE necesita coincidir con el JWT del actor. Un reporte sin sesión usable (ver punto 3) no puede pasar por esta policy — necesita el cliente admin.
   - `error_reports_select`: `reporter_id = auth.uid() or is_super_admin()`.
   - `error_reports_update_super_admin` / `_delete_super_admin`: solo super admin.
   - `error_report_messages_select`/`_insert`: mismo actor si es el reporter del `error_reports` padre, o super admin — sin política de UPDATE/DELETE (el hilo es append-only, correcto para un historial de soporte).
   - `error_reports.reporter_id` es NULLABLE — un reporte sin usuario autenticado detrás es representable.
2. **Next.js 16.3 sanea los errores de Server Component/Server Function antes de que crucen al cliente**: en producción, `error.message` que llega a `error.tsx` es genérico, NO el mensaje real — solo `error.digest` es correlacionable con los logs del servidor. Verificado en `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`. Consecuencia: **`error.tsx`/`global-error.tsx` no pueden mostrar un catálogo distinto según el error real** — seguir mostrando `ERROR_CATALOG.desconocido` (ya es lo que hacen) es lo correcto, no una limitación a resolver.
3. **`retry` es el prop estable recomendado desde Next 16.3.0** (reemplaza a `reset` para el caso normal: re-ejecuta el fetch del segmento en vez de solo limpiar el estado del boundary). Los stubs actuales de Fase 3 usan `reset` — se actualizan aquí.
4. **Un fallo de login (`fallo_inicio`) puede no tener perfil ni sesión usable** — ocurre ANTES de que `handle_new_user()` cree la fila de `profiles`. `createErrorReport()` debe soportar reportero anónimo (usa `getProfile()`, no `requireProfile()`, y cae a `createAdminClient()` + `organization_id` de `getOrganization()` cuando no hay perfil).
5. **Sin tipo de notificación nuevo**: se reutiliza `respuesta_reporte_error` (ya en el enum) para las dos direcciones — "nuevo reporte o mensaje → avisar a super admins" y "respuesta o cierre → avisar al reportero". Ya estaba anticipado así en `.claude/napkin.md` (Fase 6, punto 8: "respuesta_reporte_error es de Fase 7"), sin mención de un segundo tipo. Evita una migración de enum para una distinción que las preferencias actuales no explotan de todos modos.

## Estructura de archivos

```
src/lib/errors/
  app-error.ts            (nuevo) — clase AppError, uso: correlación en logs de servidor
  catalog.ts               (modificar) — nada estructural, ya tiene `reportable`
  fingerprint.ts           (nuevo) — hash sha256 truncado de "code:mensaje"
  report-schema.ts         (nuevo) — Zod para crear reporte y para postear mensaje
  report-actions.ts         (nuevo) — createErrorReport, postErrorMessage, updateErrorReportStatus
  get-error-reports.ts      (nuevo) — lecturas para la bandeja del super admin
  get-my-reports.ts         (nuevo) — lecturas para "Mis reportes"
  status-labels.ts          (nuevo) — labels ES de error_status/error_severity

src/components/errors/
  error-card.tsx            (modificar) — sin cambios de forma, se sigue usando igual
  report-error-dialog.tsx   (nuevo) — diálogo "Contarle al soporte"
  error-report-thread.tsx   (nuevo) — lista de mensajes + form de respuesta (compartido)
  error-report-list-item.tsx (nuevo) — fila de la bandeja/lista con severidad/estado

src/components/configuracion/
  config-tabs.tsx            (modificar) — agrega tab "Errores" (solo super_admin)
  error-status-controls.tsx  (nuevo) — selects de estado/severidad (solo super admin)

src/app/error.tsx                              (modificar) — retry + ReportErrorDialog
src/app/global-error.tsx                       (modificar) — retry, sin diálogo (limitación de estilos)
src/app/auth/auth-error/page.tsx               (modificar) — ReportErrorDialog cuando entry.reportable
src/app/(app)/configuracion/errores/page.tsx           (nuevo)
src/app/(app)/configuracion/errores/loading.tsx        (nuevo)
src/app/(app)/configuracion/errores/[id]/page.tsx      (nuevo)
src/app/(app)/mis-reportes/page.tsx                    (nuevo)
src/app/(app)/mis-reportes/loading.tsx                 (nuevo)
src/app/(app)/mis-reportes/[id]/page.tsx               (nuevo)
src/app/(app)/mi-cuenta/page.tsx                       (modificar) — link a "Mis reportes"
```

## Tarea 1 — `AppError`, fingerprint y catálogo

- `src/lib/errors/app-error.ts`: `export class AppError extends Error { code: string; constructor(code: string, message?: string) { super(message ?? code); this.code = code; this.name = "AppError"; } }`. Uso previsto: envolver un throw server-side cuando se quiere que el `console.error` en el boundary quede correlacionado con un código de catálogo — el cliente igual solo verá "desconocido" (restricción #2), el valor es para el log de servidor, no para diferenciar la UI.
- `src/lib/errors/fingerprint.ts`: `import { createHash } from "node:crypto"; export function buildFingerprint(code: string, message: string): string { return createHash("sha256").update(`${code}:${message}`).digest("hex").slice(0, 16); }`.
- `src/lib/errors/status-labels.ts`: `SEVERITY_LABEL`/`STATUS_LABEL` (Record completo de los 4 + 5 valores del enum, en español).

## Tarea 2 — Server Actions de creación y respuesta

`src/lib/errors/report-schema.ts`:
```ts
import { z } from "zod";
export const CreateReportSchema = z.object({
  user_message: z.string().trim().min(3, { error: "Cuéntanos qué intentabas hacer." }).max(500, { error: "Máximo 500 caracteres." }),
  title: z.string().trim().max(200).optional(),
  code: z.string().trim().max(60).optional(),
  technical_detail: z.string().trim().max(2000).optional(),
  stack: z.string().trim().max(4000).optional(),
  url: z.string().trim().max(500).optional(),
  user_agent: z.string().trim().max(300).optional(),
});
export const PostMessageSchema = z.object({
  body: z.string().trim().min(1, { error: "Escribe un mensaje." }).max(2000, { error: "Mensaje muy largo." }),
});
```

`src/lib/errors/report-actions.ts` — `createErrorReport(prevState, formData)`:
1. `parsed = CreateReportSchema.safeParse(...)` → si falla, `{error}`.
2. `const profile = await getProfile();` (NO `requireProfile` — debe funcionar sin sesión usable, restricción #4).
3. Si `profile`: `supabase = await createClient()`, insert con `organization_id: profile.organization_id, reporter_id: profile.id` — RLS ya lo protege.
   Si NO `profile`: `admin = createAdminClient()`, `organization_id: (await getOrganization())?.id`, `reporter_id: null` — si tampoco hay organización (no debería pasar, hay una sola), devolver error genérico.
4. `fingerprint = buildFingerprint(parsed.data.code ?? "desconocido", parsed.data.user_message)`.
5. Insert en `error_reports`: `title: parsed.data.title || "Reporte de error"`, `user_message`, `technical_detail`, `stack`, `url`, `user_agent`, `context: { code: parsed.data.code ?? null }`, `fingerprint`. `code`/`severity`/`status` usan sus defaults de columna (secuencia `ERR-YYYY-NNNN`, `media`, `nuevo`).
6. `notifyBestEffort()` → admin client, `profiles` con `role in (admin? NO — solo super_admin)` de la organización, `notify()` tipo `respuesta_reporte_error` a cada uno, `url: /configuracion/errores/{id}`, email con un template nuevo simple (ver Tarea 5).
7. Retorna `{success: "Reporte enviado", code: row.code}` (el código se muestra en la confirmación del diálogo).

`postErrorMessage(reportId, prevState, formData)`:
1. `profile = await requireProfile()` (para postear sí hace falta sesión real — tanto el reportero como el super admin están autenticados en este punto del flujo; el caso "reporte anónimo" no tiene forma de volver a responder, es aceptado).
2. `parsed = PostMessageSchema.safeParse(...)`.
3. `supabase = await createClient()` (RLS decide si puede insertar: es el reporter o es super admin — ver policy verificada).
4. Insert en `error_report_messages`. Si falla (0 filas / error RLS), `{error: "No se pudo enviar."}`.
5. `notifyBestEffort()`: hay que decidir el destinatario sin admin client si es posible — leer el `error_reports` padre (`reporter_id`, `code`, `title`) con el cliente de sesión (RLS ya lo deja ver si llegó hasta aquí). Si `profile.id === reporter_id` → el mensaje es del reportero, notificar a TODOS los super admin (admin client para listarlos, igual que Tarea 2 paso 6). Si `profile.role === "super_admin"` y no es el reporter → notificar al `reporter_id` (si no es null).
6. `revalidatePath` de ambas rutas posibles (`/configuracion/errores/${reportId}`, `/mis-reportes/${reportId}`) — no pasa nada si una de las dos no existe para este usuario.

`updateErrorReportStatus(reportId, status)` (solo super admin):
1. `await requireSuperAdmin()`.
2. `z.enum([...])` valida `status` contra los 5 valores reales del enum.
3. `update({ status, resolved_at: status === "resuelto" ? new Date().toISOString() : null })` con el cliente de sesión (RLS `error_reports_update_super_admin` ya lo permite).
4. Si `status === "resuelto"`: `notifyBestEffort()` al `reporter_id` (si no es null) tipo `respuesta_reporte_error`.
5. `revalidatePath`.

## Tarea 3 — Lecturas (bandeja del super admin y "Mis reportes")

`src/lib/errors/get-error-reports.ts` (usa el cliente de sesión — RLS ya deja ver todo a super admin):
- `getErrorReportsList({ status?, severity? }): Promise<ErrorReportListItem[]>` — `select id, code, title, severity, status, created_at, reporter_id` ordenado por `created_at desc`, filtros opcionales por igualdad. Como es lectura del super admin y RLS ya se lo permite, no hace falta admin client.
- `getErrorReportDetail(id)`: `select *` del reporte + `select * from error_report_messages where error_report_id = id order by created_at asc` + nombres para mostrar (join manual: si `reporter_id` no es null, un `select display_name, email from profiles where id = reporter_id`; los autores de cada mensaje igual, un solo `select id, display_name from profiles where id in (...)` para todos los `author_id` del hilo).

`src/lib/errors/get-my-reports.ts` (mismo cliente de sesión, RLS ya limita a `reporter_id = auth.uid()`):
- `getMyReports()`, `getMyReportDetail(id)` — misma forma que arriba, sin el dato de `reporter_id` (siempre es el propio usuario) pero sí necesita los autores de los mensajes (podría ser el propio super admin respondiendo).

## Tarea 4 — Componentes de UI

`src/components/errors/report-error-dialog.tsx` (cliente, mismo patrón de `<dialog>` nativo que `ConfirmDialog`):
- Props: `title: string`, `code?: string`, `error?: Error & {digest?: string}` (opcional — no existe en `/auth/auth-error`), `pageUrl: string` (capturado por el padre, no `window.location` adentro para que funcione igual en SSR-friendly).
- Al montar, arma el `FormData` oculto con `technical_detail` (mensaje + digest), `stack` (`error?.stack`), `user_agent` (`navigator.userAgent`, leído en un `useEffect`/al abrir), `url: pageUrl`, `code`.
- Una sola pregunta visible: `<textarea name="user_message" placeholder="¿Qué estabas intentando hacer?" />`.
- `useActionState(createErrorReport, undefined)` + `<ActionButton>`.
- Éxito: reemplaza el contenido del diálogo por "Reporte enviado — código {state.code}. Puedes ver el hilo en Mis reportes." con un `<Link href="/mis-reportes">`.

`src/components/errors/error-report-thread.tsx` (server-friendly: recibe los datos ya resueltos, el form de respuesta es un island cliente adentro):
- Lista de mensajes (`author_id` propio a la derecha, resto a la izquierda — mismo patrón visual simple, sin necesidad de librería de chat).
- Al final, un mini-form (`useActionState(postErrorMessage.bind(null, reportId), undefined)`) con `<ActionButton>`.

`src/components/configuracion/error-status-controls.tsx` (cliente, solo se monta en la bandeja del super admin): dos `<select>` (estado, severidad) con `useTransition` + `notifySuccess`.

## Tarea 5 — Correo

`emails/reporte-error.tsx` — un solo template genérico ("Actividad en un reporte de error"), reutilizado tanto para "nuevo reporte/mensaje" (al super admin) como para "respuesta/cierre" (al reportero) — el `body` que le pasa `notify()` ya distingue el texto, el email solo necesita `platformName`, `reportCode`, `summary`, `reportUrl`.

## Tarea 6 — Páginas

- `/configuracion/errores` (`requireSuperAdmin`): filtros por query string (`?status=&severity=`), lista con `ErrorReportListItem`, cada fila enlaza a `/configuracion/errores/[id]`.
- `/configuracion/errores/[id]`: `getErrorReportDetail`, si `null` → `notFound()`. Muestra datos técnicos completos (`technical_detail`, `stack`, `url`, `user_agent`, `context`) en un `<details>` colapsable, `ErrorStatusControls`, `ErrorReportThread`.
- `/mis-reportes` (`requireProfile`): `getMyReports()`, lista simple.
- `/mis-reportes/[id]`: `getMyReportDetail`, si `null` → `notFound()` (cubre tanto "no existe" como "no es tuyo", RLS ya lo filtra). `ErrorReportThread` sin controles de estado (el usuario no puede cambiar el estado, solo ver y responder).
- `ConfigTabs`: agrega `{ href: "/configuracion/errores", label: "Errores", roles: ["super_admin"] }`.
- `mi-cuenta/page.tsx`: agrega una sección/link "Mis reportes" (`<Link href="/mis-reportes">`).

## Tarea 7 — Wiring de `error.tsx` / `global-error.tsx` / `auth-error`

- `error.tsx`: cambia `reset` por `retry` (prop nueva, misma firma de invocación), agrega `useEffect(() => console.error(error), [error])` (recomendado por los docs de Next, ausente hoy), monta `<ReportErrorDialog>` como segunda acción junto al botón "Reintentar" cuando `ERROR_CATALOG.desconocido.reportable` (siempre true).
- `global-error.tsx`: cambia `reset` por `retry` únicamente — sin diálogo (no tiene Tailwind/tema disponible, ver restricción de estilos de Next). Se documenta la razón en un comentario.
- `auth/auth-error/page.tsx`: agrega `<ReportErrorDialog>` junto a la acción existente cuando `entry.reportable` (no tiene `error` real, solo `code: motivo` y `pageUrl`).

## Tarea 8 — Cierre de fase

- `npm run typecheck && npm run lint && npm run build` limpios.
- `/code-review --high` a convergencia (con verificación SQL real de cualquier hallazgo de RLS, igual que Fases 4-6).
- Actualizar `.claude/napkin.md` (sección nueva "Centro de errores (Fase 7)"), `docs/database.md` (confirma que no hubo migraciones nuevas — todo el esquema ya existía), `README.md` (Fase 7 ✅).
- Commit + push a `claude/ats-platform-design-8ve51p` (regla de cierre de fase).
