# Base de datos — Supabase

**Proyecto**: `V1-motoslam` (ref `cgudnnlcwcotovcslgzu`), reutilizado y limpiado por indicación del usuario — tenía un sistema de vacaciones "PCG" sin uso que se eliminó por completo (tablas, tipos, función y políticas de storage) antes de montar el esquema del ATS.

## Cómo se generó

Todo el esquema vive como migraciones aplicadas vía el MCP de Supabase (`apply_migration`), no como archivos `.sql` en el repo — Supabase es la fuente de verdad y `list_migrations` desde el MCP reconstruye el historial completo si hace falta. Lo que sí vive en el repo es lo que el código de Next.js necesita:

- `src/lib/supabase/database.types.ts` — tipos generados con `generate_typescript_types`. Se regenera y commitea cada vez que cambia el esquema.
- Este documento.

## Multi-tenancy

Una sola organización (`organizations`, slug `principal`) para v1, pero **todas** las tablas llevan `organization_id` desde el día uno. Abrir a SaaS después significa agregar organizaciones, no migrar el esquema.

## Rol y organización viajan en el JWT

`public.custom_access_token_hook(event jsonb)` lee `profiles.role` y `profiles.organization_id` en cada emisión de token y los mete en `app_metadata`. Las políticas RLS leen `auth.jwt()` a través de `private.auth_role()` / `private.auth_org_id()` — **nunca consultan `profiles`**, evitando la recursión clásica.

> ⚠️ **Paso manual pendiente, fuera del alcance del MCP**: en el Dashboard de Supabase → Authentication → Hooks → "Customize Access Token (JWT) Claims hook", seleccionar `public.custom_access_token_hook`. Sin este paso el hook existe pero Auth no lo invoca, y `private.auth_role()`/`private.auth_org_id()` devuelven `null` para todos.
>
> ⚠️ **Segundo paso manual, Fase 3**: Authentication → Providers → Google, con un OAuth Client ID/Secret de Google Cloud Console (redirect URI `https://cgudnnlcwcotovcslgzu.supabase.co/auth/v1/callback`). Sin esto el botón "Entrar con Google" no funciona en absoluto.

Hay una política de respaldo, `profiles_select_own` (`id = auth.uid()`), independiente del hook: garantiza que cualquiera pueda leer su propia fila de `profiles` incluso si el hook de arriba no está activado todavía — sin ella, el callback de login no podría ni verificar el estado de la cuenta que acaba de entrar.

## Roles y visibilidad

| Rol | jobs | candidates / applications |
|---|---|---|
| `colaborador` | solo públicas + abiertas (portal) | solo lo que refirió (`referred_by`) |
| `gestor` | las que solicitó o donde es colaborador (`job_collaborators`) | las de sus vacantes |
| `admin` / `super_admin` | todas de su organización | todas de su organización |

`error_reports` es la excepción: **incluso admin ve solo lo propio** — es un canal de soporte 1-a-1 con el super admin, no un tablero compartido.

## Bug real encontrado y corregido durante la verificación

Las políticas de `candidates` y `applications` se consultaban una a la otra dentro de sus condiciones (`candidates_select` hacía `EXISTS` sobre `applications`, y `applications_select` hacía `EXISTS` sobre `candidates`). Postgres dispara la política de cada tabla referenciada, así que esto producía **recursión infinita (42P17)** en cuanto ambas condiciones se evaluaban en la misma consulta.

**Corrección**: dos funciones `SECURITY DEFINER` en `private` (`candidate_has_accessible_application`, `candidate_referred_by_me`) que consultan la tabla contraria directamente. Como las tablas son propiedad de `postgres` (sin `FORCE ROW LEVEL SECURITY`), una función `SECURITY DEFINER` ejecuta como su dueño y no vuelve a disparar RLS — rompe el ciclo sin perder la regla de negocio.

**Lección para toda política futura**: si la tabla A referencia a la tabla B dentro de su USING/CHECK, y B también referencia a A, envolver una de las dos consultas en una función `SECURITY DEFINER`. Se verificó con datos reales simulando JWT de cada rol (`set_config('request.jwt.claims', ...)` + `set role authenticated`), no solo leyendo las políticas.

## Endurecimiento de `profiles` (Fase 3)

Cuatro migraciones sobre `profiles` para cerrar carreras entre el chequeo de la app y el UPDATE real:

- `25_profiles_select_own_fallback` — política `profiles_select_own` (ver arriba, "Rol y organización viajan en el JWT").
- `26_harden_profiles_super_admin_race` — la política `profiles_write_admin` ahora exige también `(role <> 'super_admin' or (select private.is_super_admin()))` en `USING`/`WITH CHECK`. Sin esto, la única barrera contra que un `admin` común edite o degrade a un `super_admin` era el chequeo en el Server Action — un `UPDATE` disparado directo (o un Server Action modificado) lo hubiera evadido. Verificado con una simulación SQL real (JWT de `admin` intentando degradar a un `super_admin`): la fila queda sin cambios y Postgres devuelve `0 rows`.
- `27_guard_last_super_admin` — trigger `BEFORE UPDATE` `private.guard_last_super_admin()`: si la fila que se actualiza es un `super_admin` activo y el cambio la deja inactiva o le quita el rol, cuenta cuántos `super_admin` activos quedarían en la organización (excluyéndose a sí misma) y lanza una excepción si el resultado es cero.
- `28_serialize_last_super_admin_guard` — el mismo trigger, con `pg_advisory_xact_lock(hashtext(old.organization_id::text))` justo antes de contar. Sin el lock, dos `UPDATE` concurrentes sobre los dos últimos `super_admin` de una organización podían contar "1 activo restante" cada uno antes de que cualquiera confirmara, y ambos pasar — dejando la organización sin nadie que pueda entrar a `/configuracion/marca`. El advisory lock serializa esas transacciones por organización.

El Server Action (`wouldRemoveLastSuperAdmin` en `src/lib/users/actions.ts`) hace el mismo chequeo de antemano — no porque sea la barrera real (lo es el trigger), sino para devolver un mensaje de error específico en el caso no concurrente. Si el trigger es quien termina bloqueando, el usuario ve el mensaje genérico de "no se pudo actualizar"; la integridad de datos no depende de eso.

## Vacantes y pipeline (Fase 4)

El esquema de `jobs`, `job_stages`, `job_collaborators`, `candidates`, `applications`, `application_events`, `attachments`, `pipeline_templates`/`pipeline_template_stages` y `rejection_reasons` ya existía desde la Fase 2 — Fase 4 es capa de aplicación pura sobre ese esquema. Dos hallazgos reales al construir esa capa:

- **`pipeline_templates` y `job_stages` son de escritura/lectura admin-only** (`pipeline_templates_admin`, `job_stages_write_admin`, ambas `USING (private.is_admin_or_above())`). Un `gestor` puede crear su propia vacante (`jobs_insert` sí lo permite), pero copiar la plantilla de pipeline a `job_stages` **tiene que hacerse con `createAdminClient()`**, no con el cliente de sesión del gestor — de lo contrario su `SELECT` a `pipeline_templates` vuelve vacío y la vacante se crea sin ningún pipeline. Mismo razonamiento para la deduplicación de `candidates` por email en los referidos internos: `candidates_select` está filtrada por `referred_by`/`created_by`/admin, así que un colaborador sin relación con un candidato que otro ya refirió no lo vería y crearía uno duplicado si la búsqueda se hiciera con su propio cliente.
- **`29_one_default_pipeline_template_per_org`** — índice único parcial `on pipeline_templates (organization_id) where is_default`. Nada en el esquema de Fase 2 impedía dos filas `is_default = true` en la misma organización, lo que habría hecho fallar el `.single()` de `materializeJobStages` con "más de una fila" en vez de la plantilla real.

`jobs.slug` tiene un índice único parcial por organización (`jobs_org_slug_key`, `where slug is not null`) generado en Fase 2; Fase 4 lo llena con `título-slugificado + nanoid(6)` al crear la vacante (`src/lib/jobs/slug.ts`), sin round-trip a la base para chequear disponibilidad — si llegara a colisionar (extremadamente improbable), el índice único hace fallar el `INSERT` con un error genérico y reintentable, nunca un duplicado silencioso.

### Ruta de Storage de los CV — contrato con la política, no con el sentido común

`cvs_privado_select`/`cvs_privado_delete` (bucket `cvs-privado`, Fase 2) exigen `private.can_access_candidate((storage.foldername(name))[2]::uuid)` — el **segundo** segmento de la ruta tiene que ser el `candidate_id`. El primer Route Handler de postulación de Fase 4 subía a `{organization_id}/{email}/{timestamp}.pdf`, que no cumple ese contrato (el segundo segmento era un correo, no un UUID) — el control de acceso a los CV estaba roto desde el primer commit de Fase 4, sin que nada del flujo de postulación lo delatara. Se corrigió resolviendo/creando el candidato **antes** de subir el archivo, para poder construir la ruta como `{organization_id}/{candidate_id}/{timestamp}.pdf` (`src/lib/jobs/create-application.ts`, `findOrCreateCandidate` + `createApplicationForCandidate`). Cualquier subida futura a un bucket privado con políticas basadas en `storage.foldername()` debe verificar el índice exacto que la política espera antes de construir la ruta.

## Pipeline y candidatos (Fase 5)

Capa de aplicación pura sobre `applications`, `application_events`, `notes`, `attachments`, `rejection_reasons` y `job_stages` (todos de Fase 2) — kanban de arrastrar y soltar, detalle de postulación con timeline, notas, calificación, rechazo y contratación.

- **`30_check_applications_rating_range`** — `CHECK (rating is null or rating between 1 and 5)` en `applications`. `rating` era `smallint` sin restricción; el rango 1-5 ya se validaba en Zod en el único camino de escritura (`setRating`, un Server Action — nunca hay escritura directa desde un cliente `anon`), pero el `CHECK` cierra la brecha por si alguna vez se escribe desde otro lado (una migración de datos, una función administrativa) sin pasar por esa validación.
- **`notes_select` deja ver una nota privada a su propio autor siempre**, sin importar el rol — solo esconde las privadas de OTROS no-admin. Esto significa que un `gestor` puede escribir una nota `is_private` y seguir viéndola después; no hace falta bloquear ese checkbox para ningún rol que ya pueda escribir notas en la vacante.
- **`applications_select` no depende del estado de la vacante** para el colaborador que refirió al candidato (`candidate_referred_by_me`), pero `jobs_select`/`job_stages_select` sí — un colaborador puede ver su postulación referida con `jobs`/`job_stages` embebidos en `null` si la vacante se pausó o cerró después. Ver `.claude/napkin.md`, sección "Pipeline y candidatos (Fase 5)", punto 1, para el bug real que esto causó y su corrección.

### Rendimiento de políticas RLS — InitPlan

Todas las políticas envuelven las llamadas a `auth.uid()`, `auth.jwt()` y las funciones de `private.*` sin argumentos en `(select ...)`, para que Postgres las evalúe como InitPlan una sola vez por consulta en vez de una vez por fila (hallazgo del advisor de Supabase, `auth_rls_initplan`). Las funciones que sí dependen de una columna de la fila (`can_access_job(id)`, `can_access_candidate(id)`) se dejan sin envolver porque no hay nada que precalcular.

Quedan como advertencias aceptadas, no corregidas:
- `multiple_permissive_policies` en `jobs`, `profiles`, `departments`, `job_stages`, `job_collaborators`, `rejection_reasons` — la política de admin (`FOR ALL`) solapa con la política de lectura general en `SELECT`. Partirla en políticas separadas por comando eliminaría el solape, pero es una ganancia marginal en tablas de baja cardinalidad; se prioriza esquema simple.
- `pg_net` instalado en `public` — la extensión no soporta `ALTER EXTENSION SET SCHEMA`; venía preinstalada en el proyecto reutilizado, no la creamos nosotros.
- Protección de contraseñas filtradas desactivada — no aplica: la única autenticación es Google OAuth, sin contraseñas.

## Notificaciones in-app y correo (Fase 6)

`notifications` y `notification_preferences` se crearon en Fase 2; Fase 6 es la primera capa de aplicación que las usa de verdad, más tres migraciones nuevas:

- **`31_enable_realtime_notifications`** — `alter publication supabase_realtime add table notifications;`. Sin esto, la campana (`postgres_changes` sobre `notifications`) se suscribe sin error pero nunca recibe nada — Realtime no transmite cambios de una tabla que no está en la publicación, y no hay ningún mensaje de fallo que lo delate.
- **`32_notification_preferences_organization_id`** — se agregó `organization_id uuid not null references organizations(id)` (con índice) a `notification_preferences`, que había quedado sin esa columna desde el esquema de Fase 2 pese a la regla de AGENTS.md ("toda tabla lleva `organization_id`, incluso operando un solo tenant"). La tabla estaba vacía al momento de la migración, así que no hizo falta backfill.
- **`33_notification_preferences_org_scoped_policy`** — la policy `notification_preferences_own` original solo comprobaba `profile_id = auth.uid()`; se reemplazó por `profile_id = (select auth.uid()) and organization_id = private.auth_org_id()` en `USING`/`WITH CHECK`, para que la nueva columna quede realmente validada contra el JWT y no solo presente de nombre.
- **`notifications` no tiene política de INSERT para `authenticated`** — a propósito, no un descuido: casi nunca se notifica a uno mismo, y `notify()` (`src/lib/notifications/notify.ts`) necesita leer la preferencia del DESTINATARIO, no la del actor que disparó el evento. Por eso `notify()` usa siempre `createAdminClient()`, sin excepción.
- **`email_sent_at`** en `notifications` solo se completa cuando Resend confirmó el envío (`sendEmail()` no devolvió error) — una notificación con `email_sent_at is null` pero con preferencia de correo activada es la señal de que el correo falló o nunca se intentó, útil para el Centro de errores de Fase 7.

Los cuatro disparadores reales conectados en Fase 6 (`submitForApproval`, `referCandidate` en `src/lib/jobs/actions.ts`; `moveApplicationStage` en `src/lib/applications/actions.ts`; `POST /api/postular`) corren su notificación/correo con `after()` de Next (`notifyBestEffort()`), nunca `await` antes de responder — un fallo de Resend o de la propia inserción en `notifications` no debe convertir una mutación ya guardada en un error de cara al usuario. Ver `.claude/napkin.md`, sección "Notificaciones in-app y correo (Fase 6)", para el detalle de cada hallazgo (incluye un bug real que rompía `next build` por instanciar el cliente de Resend a nivel de módulo).

## Colaboradores por vacante + bitácora (Fase 8)

`job_collaborators` y `audit_log` ya existían completos desde Fase 2 (esquema + RLS); Fase 8 fue capa de aplicación sobre ellas, más una migración nueva:

- **`enforce_application_permission_tiers`** — RLS (`can_access_job()`, usada en `applications_update`) deja pasar a cualquier colaborador por igual, sin distinguir su `permission` (viewer/interviewer/approver/owner) — a propósito, sigue gobernando solo visibilidad/acceso general. La distinción de nivel para *decidir* (`status`, `stage_id`) y *calificar* (`rating`) vive en dos funciones nuevas, `private.can_decide_application(job_id)`/`private.can_rate_application(job_id)`, y un trigger `BEFORE UPDATE` en `applications` que las llama — espejo exacto de `canDecideApplication`/`canRateApplication` en `src/lib/applications/permissions.ts`. Es defensa en profundidad: la Server Action ya bloquea antes de llegar aquí; el trigger cierra el hueco de alguien llamando Supabase directo desde el navegador con su propia sesión.
- Verificado con simulación de rol real (transacción con rollback: `set_config('request.jwt.claims', ...)` + `set role authenticated`, un job/postulación de prueba) — viewer bloqueado en ambas, interviewer solo puede calificar, approver puede las dos, incluyendo el trigger disparando de verdad, no solo la función aislada.
- `audit_log_select_super_admin` tiene el mismo hueco de organización que `error_reports` (Fase 7) — sin corregir, mitigado en la app (`getAuditLog()` filtra por `organization_id`). Ver `.claude/napkin.md`.

## Tareas del candidato (Fase 10)

**`candidate_tasks`** — primera tabla nueva desde el esquema fundacional de Fase 2. Mismo patrón de RLS que `notes`: visible/insertable por admin+ o por quien tenga acceso a la vacante (`can_access_job(job_id)`, vía join a `applications`); editable (marcar completada) por quien la creó, a quien se le asignó, o admin+; borrable solo por quien la creó o admin+.

`assigned_to` se valida server-side contra `isProfileAssignable()` (`src/lib/applications/get-applications.ts`) antes de insertar — el `<select>` del formulario ya solo ofrece gente con acceso real a la vacante, pero eso es solo la UI (mismo patrón de validación ya aplicado a `job_collaborators` en Fase 8 y a `head_profile_id` de departamentos en Fase 9).

## Evaluación por competencias (Fase 11)

**`job_competencies`** (rúbrica por vacante: nombre + peso 0-100) y **`application_competency_scores`** (calificación 1-5 + comentario, `unique(application_id, competency_id, evaluator_id)`). Mismo patrón de RLS que `candidate_tasks`, con un ajuste real: las políticas de `UPDATE`/`DELETE` sobre la propia fila (`evaluator_id = auth.uid()`) también revalidan `can_access_job` — no alcanza con "es mi fila", porque el acceso a la vacante pudo revocarse después de crearla (ver napkin.md).

`submitScore()` (`src/lib/competencies/actions.ts`) valida que `competencyId` y `applicationId` compartan el mismo `job_id` antes de guardar — no hay FK que lo fuerce (son columnas de tablas distintas), así que la Server Action lo comprueba a mano.

`weight` se captura pero todavía no alimenta un puntaje global ponderado — cada competencia solo muestra su promedio simple entre evaluadores.

## Plantillas de mensaje y correo directo al candidato (Fase 12)

**`message_templates`** (organización, nombre, asunto, cuerpo) — mensajes reutilizables para escribirle a un candidato. RLS distinto al resto del configurador (`pipeline_templates`/`email_templates`, admin-only en todo): aquí `SELECT` es para cualquier miembro de la organización (igual que `rejection_reasons`) porque cualquiera que pueda enviar un mensaje necesita poder elegir una plantilla, y solo `INSERT`/`UPDATE`/`DELETE` exigen `is_admin_or_above()`. Mutaciones sin filtro `organization_id` adicional en el `WHERE` — confían solo en RLS vía `.eq("id", id)`, mismo patrón que `departments`/`rejection_reasons`.

`sendCandidateMessage()` (`src/lib/applications/actions.ts`) reusa `canDecideApplication` para autorizar el envío — mismo permiso que Contratar/Rechazar, no uno nuevo. El destinatario (`candidates.email`) se resuelve siempre server-side desde `applicationId`, nunca desde un campo del formulario. El envío usa `sendEmail()` (Resend) directo, no `notify()` — el candidato no es un `profile`, no tiene preferencias de notificación. El evento `correo_enviado` (existía en el enum desde Fase 6, sin productor hasta ahora) se registra en `application_events` con el asunto en el payload.

## Entrevistas y Google Calendar (Fase 13)

**`interviews`** (postulación, entrevistador, fecha/hora, duración, lugar, notas, `status` programada/completada/cancelada). RLS gemela de `candidate_tasks`: `SELECT`/`INSERT` exigen `can_access_job(job_id)` o admin+; `UPDATE` agrega `interviewer_id = auth.uid()` como auto-servicio (igual que `assigned_to` en tareas); `DELETE` solo `created_by` o admin+.

La capa de aplicación es más estricta que Tareas a propósito: `scheduleInterview()`/`deleteInterview()` exigen `canDecideApplication` (no solo acceso RLS a la vacante) porque agendar dispara un correo al candidato a nombre de la plataforma — mismo nivel que `sendCandidateMessage`. `updateInterviewStatus()` deja pasar además a quien es `interviewer_id` de esa fila específica, para que pueda marcar su propia entrevista sin ser approver/owner. Compare-and-swap contra `status = 'programada'` en el `UPDATE` — mismo patrón que las transiciones de `applications`.

Sin integración real con la API de Google Calendar (requeriría OAuth con scope `calendar.events`, guardado de refresh token y configuración manual en Google Cloud Console). En su lugar, `src/lib/interviews/calendar-link.ts` arma un enlace `calendar.google.com/calendar/render` — cada quien agrega el evento a su propio calendario con un clic, sin credenciales nuevas. El correo al candidato muestra la hora en UTC explícito (el servidor no conoce la zona horaria de la organización ni la del candidato) y remite al enlace, que sí ajusta la hora a la zona de quien lo abre.

## Segmentos y filtros de candidatos (Fase 14)

**`candidate_segments`** (organización, nombre, `filters` jsonb, autor). Compartidos entre toda la organización: `SELECT` para cualquier miembro (igual que `message_templates`/`rejection_reasons`), `INSERT` fuerza `created_by = auth.uid()` en el `WHERE CHECK` (no se puede falsificar el autor), `DELETE` solo `created_by` o admin+.

`/candidatos` se reescribió con filtros (vacante, tipo de etapa, estado, texto libre) validados con un único schema Zod (`CandidateFiltersSchema`) reusado tanto para leer la URL como para el formulario de guardar segmento — antes había una validación ad hoc con el operador `in` sobre un mapa de etiquetas, vulnerable a la cadena de prototipos de JS (`?stage_type=constructor` pasaba la validación). El filtro por tipo de etapa se aplica en JS después de traer las filas, no con `.eq()` sobre un embed `job_stages!inner` — ese `!inner` forzado reintroducía el bug de Fase 5 (RLS de `job_stages` más estricta que la de `applications`, la fila entera desaparecía en silencio en vez de solo la etapa).

Sin acciones masivas ni paginación real todavía — `.limit(100)` con un aviso en la UI cuando el resultado llega justo a ese límite, para no fingir que la lista está completa. Ver `.claude/napkin.md` para el detalle de alcance recortado.

## Motor de plantillas de vacante (Fase 15)

**`job_templates`** (organización, nombre, título, país, ubicación, modalidad, tipo de contrato, descripción, requisitos). Mismo patrón de RLS que `message_templates`: `SELECT` para cualquier miembro de la organización (gestor necesita leerlas para prellenar `/vacantes/nueva`), `INSERT`/`UPDATE`/`DELETE` solo admin+. Verificación live de las políticas (no simulación de rol nueva — estructura idéntica byte a byte a `message_templates`, ya probada en Fase 12).

`JobTemplateSchema` (`src/lib/job-templates/schema.ts`) se deriva de `JobBaseSchema.pick({...}).extend({name})` en vez de retipar los campos — `src/lib/jobs/schema.ts` se separó en `JobBaseSchema` (sin `.refine()`) y `JobFormSchema = JobBaseSchema.refine(...)` porque Zod v4 no permite `.pick()` sobre un schema ya refinado.

`/vacantes/nueva` gana un selector de plantilla que prellena `JobForm`. El mecanismo original (`TemplatePicker`, navegaba a `?template=id`, remontaba el formulario entero con una `key`) se reemplazó por completo en Fase 17 — ver esa sección.

En `JobTemplateDialog`: reabrir "Editar" sobre la misma plantilla tras guardarla mostraba el valor viejo (formulario no controlado, `defaultValue` no se actualiza solo) — corregido con `key={template.updated_at}` en el uso del diálogo, esto sigue vigente.

## Configurador de bolsa pública (Fase 16)

**`organizations.careers_headline`/`careers_intro`** (`text`, nullable) — dos columnas más en la fila de `organizations` que ya existía, no una tabla nueva. RLS de fila cubre las columnas nuevas automáticamente (Postgres no tiene RLS por columna); la política de `UPDATE` sigue siendo `super_admin`-only, deliberado — bajarla a `admin+` en la acción compartida (`updateBranding`) le daría a cualquier admin la capacidad de tocar también logo/color/nombre de la plataforma, la misma fila. Si se necesita que `admin` edite solo el copy de la bolsa, la solución es sacar estas dos columnas a una tabla aparte con su propia política, no relajar `organizations_update_super_admin`.

Reusa por completo el flujo de Marca (Fase 3): mismo formulario (`BrandingForm`), misma acción (`updateBranding`), misma página (`/configuracion/marca`) — sin página ni componente nuevo. `/empleos` (portal público) los lee vía `getOrganization()` (ya cacheada con `cache()`, ya reusada por `empleos/layout.tsx`) con fallback a "Vacantes abiertas" si no están configurados.

## Fusión de plantilla de vacante + pipeline/competencias (Fase 17)

`job_templates` gana `pipeline_template_id` (FK a `pipeline_templates`, nullable, `on delete set null`) y `competencies` (`jsonb`, array de `{name, weight}`). Sin cambio de RLS — cubierto por las políticas de fila ya existentes de `job_templates`.

**Decisión de seguridad, la más importante de esta fase:** `/vacantes/nueva` solo manda `template_id` al servidor, nunca el contenido de la plantilla. `createJob` vuelve a leer `pipeline_template_id`/`competencies` desde `job_templates` con el cliente de SESIÓN (permitido por `job_templates_select`, cualquier miembro de la organización) antes de decidir qué escribir. La primera versión de este cambio mandaba el contenido de la rúbrica (nombre/peso) en un campo oculto y lo insertaba tal cual usando el cliente admin — eso permitía a un `gestor` (sin acceso de escritura directo a `job_competencies`, que exige admin+) fabricar un POST con competencias arbitrarias y saltarse ese permiso por completo. Ver `.claude/napkin.md` para el detalle.

El pipeline se materializa igual que siempre (`materializeJobStages`, Fase 5) pero ahora acepta un `pipelineTemplateId` opcional — si la plantilla de vacante especificó uno, se usa ese en vez de la plantilla de pipeline predeterminada de la organización. Las competencias se insertan en un solo `INSERT` con `position` explícito por índice (mismo patrón que las etapas), con el cliente admin por el mismo motivo que `materializeJobStages` (un gestor no tiene RLS de escritura sobre `job_competencies`, aunque sí puede crear su propia vacante).

`NuevaVacanteForm` fusiona los campos visibles de la plantilla elegida SOLO si están vacíos (`fillIfEmpty`, manipula el DOM directo vía `form.elements.namedItem`) — a diferencia del mecanismo de Fase 15 (remount con `key`, que reemplazaba todo el formulario), esto preserva lo que el usuario ya haya escrito a mano. `JobForm` expone su `<form>` con `forwardRef` para esto, y acepta `children` (el único hidden input `template_id`) en vez de cargar ese campo también en el flujo de editar, que no lo usa.

## Esquema del wizard de plantillas de vacante (Fase 18, 1/7)

Ver `docs/superpowers/specs/2026-09-01-plantillas-vacante-wizard-design.md` para
el diseño completo. Esta entrega es solo esquema y RLS — sin UI todavía (las
fases 2-7 la construyen encima, cada una con su propio plan).

- `job_templates` gana `created_by`, `is_public`, `status`
  (`draft`/`published`), `is_confidential`, `candidacy_fields` (jsonb,
  tri-estado por campo). `private.can_view_job_template(id)` — función
  `SECURITY DEFINER`, mismo motivo que `candidate_has_accessible_application`
  (Fase 2): sin eso, la política de `job_templates_select` llamándose a sí
  misma vía la tabla produce recursión infinita.
- `job_template_questions`/`job_template_question_options`/`job_template_stages`
  — hijas de `job_templates`, mismo patrón de lectura
  (`can_view_job_template`), escritura admin+. Las opciones llevan
  `job_template_id` duplicado (no solo `question_id`) a propósito: sin eso, la
  confidencialidad de la plantilla no cubriría sus propias opciones sin un
  segundo join o una segunda función.
- `employment_reasons` — a diferencia de `rejection_reasons`, el `INSERT` es
  para cualquier rol que pueda crear una vacante (no solo admin+): es una
  lista operativa con alta inline desde el selector, no una política de
  rechazo.
- `jobs` gana `vacancy_type` (Nueva posición/Reemplazo/Crecimiento) —
  deliberadamente NO se llama `employment_type`, esa columna ya existe y
  significa tipo de *contrato* (indefinido/temporal/por obra/pasantía),
  agregada desde Fase 2. `employment_reason_id`, `job_template_id` (solo
  trazabilidad, no se vuelve a leer tras crear la vacante — mismo principio
  de seguridad que Fase 17 con `pipeline_template_id`/`competencies`),
  `candidacy_fields` (copia de la plantilla al crear).
- `job_questions`/`job_question_options` — mismo shape que sus pares de
  plantilla, colgando de `jobs`, `can_access_job(job_id)` en vez de
  `can_view_job_template`. Sus políticas de escritura sí quedaron `FOR ALL`
  (a diferencia de las de plantilla, ver abajo) porque `can_access_job()`
  empieza con `is_admin_or_above() OR ...` — un admin+ ya tiene acceso
  incondicional a toda vacante de su organización, así que `FOR ALL` no le
  regala ningún `SELECT` que no tuviera igual.
- `application_answers` — sin política de escritura para ningún rol de
  sesión, mismo patrón deliberado que `notifications` (Fase 6): el único
  camino de escritura es `createAdminClient()` desde `/api/postular`.
  `applications` gana `prequalified` (nullable — `null` si la vacante no
  tiene preguntas de opción múltiple).
- `candidates.address`, `applications.cover_letter` — campos que hoy no
  existen en ningún lado, no una ampliación de algo oculto. "Archivos
  adicionales" no necesita columna nueva: `attachments.kind` ya es `text`
  libre sin `CHECK`, se sube con `kind = 'adicional'`.
- **Bitácora dentro de la vacante**: `audit_log_select_super_admin` se
  reemplaza por `audit_log_select`, que agrega la rama
  `entity_type = 'job' and can_access_job(entity_id)` — cualquier
  colaborador de esa vacante ve sus propios eventos, no toda la bitácora. De
  paso cierra el hueco de organización documentado en Fase 8 (la rama de
  `super_admin` ahora exige `organization_id = auth_org_id()` también) — sin
  ampliar a quién ve el resto de la bitácora. Verificado con simulación de
  rol real: un `gestor` colaborador de una vacante ve el evento de esa
  vacante y no ve un evento de otra entidad (`department`).

### Bug real encontrado y corregido: `FOR ALL` incluye `SELECT`

`job_templates_write_admin` (Fase 15, ya existía) estaba declarada `FOR ALL`.
En Postgres una política `FOR ALL` también gobierna `SELECT`, y las políticas
permisivas se combinan con `OR` — así que aunque `job_templates_select` (esta
fase) negara correctamente ver una plantilla confidencial, la política de
escritura por sí sola igual dejaba verla a cualquier `admin+` de la
organización, sin pasar por `can_view_job_template`. Se detectó simulando el
rol real (no leyendo la política) e insertando una plantilla confidencial de
otro creador — sin la corrección, `select count(*)` la devolvía visible.

**Corrección**: `job_templates_write_admin` y las tres políticas de escritura
de sus hijas (`job_template_questions`/`job_template_question_options`/
`job_template_stages`) se partieron en `INSERT`/`UPDATE`/`DELETE` por
separado, ninguna cubre `SELECT`. Re-verificado tras el cambio: un `admin` no
creador ya no ve la plantilla confidencial; el creador y `super_admin` sí.

**Lección para toda política futura**: si una tabla tiene una política de
lectura con una condición más estricta que "cualquiera del rol X" (acá,
confidencialidad), ninguna otra política sobre esa tabla puede declararse
`FOR ALL` — hay que partirla, o esa condición estricta queda de adorno.

## Wizard de plantillas de vacante — Paso 1 "Detalles" (Fase 18, 2/7)

Primera entrega de UI sobre el esquema de la 1/7. Solo el paso 1 —
`/configuracion/plantillas-vacante/nueva` crea la plantilla en `status =
'draft'` (default de la columna) y vuelve al listado con confirmación; los
pasos 2-6 son entregas siguientes, cada una con su propio plan.

- **`job_templates.department_id`** (FK a `departments`, nullable) — hueco
  real en la 1/7: el wizard pide Departamento en el paso 1, pero la tabla
  nunca tuvo esa columna (a diferencia de `jobs`, que sí la tiene desde Fase
  2). Se agregó al construir el paso que la necesita, no antes.
- **Bug real de regresión, encontrado y corregido antes de commitear:**
  `job_templates.status` (agregada en 1/7, default `'draft'`) hizo que
  `createJobTemplate()` (el diálogo plano de Fase 15, que sigue existiendo
  para creación de un solo paso) empezara a crear plantillas invisibles para
  "Solicitar vacante" — `getPublishedJobTemplates()` (nueva, filtra
  `status = 'published'`) las hubiera excluido a todas. Corregido
  insertando `status: 'published'` explícito en esa acción: el diálogo
  viejo sigue siendo "todo en un paso, queda listo de inmediato"; solo el
  wizard nuevo (progresivo) deja la plantilla en borrador hasta su paso de
  cierre (2026, aún sin construir). `updateJobTemplate` no necesitó el mismo
  fix — nunca toca `status` en su `.update()`, así que no revierte una
  plantilla ya publicada.
- **Puesto/Título del anuncio**: el wizard reusa las columnas existentes
  `name`/`title` con etiquetas nuevas ("Puesto"/"Título del anuncio de la
  vacante") — no se agregó ninguna columna para esto, es un cambio de
  rótulo en la UI, no de esquema.
- **Rúbrica de evaluación**: el paso 1 sigue mostrando
  `CompetencyListEditor` (Fase 11/17) tal cual — la lista de pasos del
  wizard que pidió el usuario no menciona la rúbrica por separado, y
  "Detalles" es la lectura más razonable de dónde vive esa info general.

## Wizard de plantillas de vacante — Paso 2 "Candidatura" (Fase 18, 3/7)

`/configuracion/plantillas-vacante/[id]/paso-2` — tri-estado
(`hidden`/`optional`/`required`) sobre `job_templates.candidacy_fields`
(columna ya agregada en la 1/7). `email` no es un campo del formulario ni del
`WizardStep2Schema` — el servidor lo fuerza a `required` siempre
(`{ ...parsed.data, email: "required" }`), nunca confía en un valor que
mande el cliente para ese campo en particular.

Se agregó `/[id]/paso-1` (reeditar el paso 1 de una plantilla ya creada,
para que "Atrás" desde el paso 2 tenga a dónde ir) y un botón "Continuar" en
el listado para plantillas en borrador — apunta directo a `paso-2`, que es
la frontera resumible mientras solo existan los pasos 1 y 2.

### Segundo hallazgo: `created_by` necesita `DEFAULT`, no solo backfill

`auth.uid()` no sirve como `DEFAULT` de columna en el momento de la migración
(no hay contexto de request, evalúa `null` para las filas ya existentes) — por
eso el backfill de `created_by` corrió como un `UPDATE` aparte antes de fijar
`NOT NULL`. Pero sin un `DEFAULT` real, `createJobTemplate()` (Fase 15, nunca
mandó `created_by`) hubiera roto en producción con cualquier plantilla nueva.
Se agregó `ALTER COLUMN created_by SET DEFAULT auth.uid()` **después** del
backfill — de acá en adelante sí hay contexto de request real en cada
`INSERT`, así que el default resuelve al actor correcto sin tocar la Server
Action. `getJobTemplates()` también amplió su lista de columnas para incluir
las 5 nuevas (antes solo pedía las de Fase 15/17) — sin eso, el tipo que
devuelve no cumplía `JobTemplate` y el build no compilaba.

## Storage

| Bucket | Público | Contenido |
|---|---|---|
| `marca-publico` | sí | Logos y la imagen de login, editables por el super admin |
| `cvs-privado` | no | CVs y adjuntos, servidos siempre por URL firmada de 60 s. Ruta: `candidates/{candidate_id}/{archivo}` |

`V1-motoslam` tenía un bucket `archivos` del sistema anterior con 1 objeto huérfano. Los objetos y buckets de Storage no se pueden borrar por SQL directo (`Direct deletion from storage tables is not allowed`); requiere la API de Storage con la service role key, que no se expone por MCP. **Queda pendiente que el usuario lo borre manualmente** desde el Dashboard si quiere el proyecto completamente limpio — no interfiere con el ATS porque usa nombres de bucket distintos.

## Seed

- Una organización (`principal`).
- Un pipeline por defecto con las 6 etapas del diseño: Postulado → Preselección → Entrevista RH → Entrevista con jefe → Oferta → Contratado.
- 6 motivos de rechazo de catálogo.
- El super admin (`giancaremma50@gmail.com`) se resuelve por el trigger `handle_new_user()` en su primer inicio de sesión con Google — no hay que crearlo a mano.
