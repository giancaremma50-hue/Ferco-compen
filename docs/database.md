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
