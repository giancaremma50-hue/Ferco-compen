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

### Ruta de Storage de los CV — contrato con la política, no con el sentido común

Todas las políticas envuelven las llamadas a `auth.uid()`, `auth.jwt()` y las funciones de `private.*` sin argumentos en `(select ...)`, para que Postgres las evalúe como InitPlan una sola vez por consulta en vez de una vez por fila (hallazgo del advisor de Supabase, `auth_rls_initplan`). Las funciones que sí dependen de una columna de la fila (`can_access_job(id)`, `can_access_candidate(id)`) se dejan sin envolver porque no hay nada que precalcular.

Quedan como advertencias aceptadas, no corregidas:
- `multiple_permissive_policies` en `jobs`, `profiles`, `departments`, `job_stages`, `job_collaborators`, `rejection_reasons` — la política de admin (`FOR ALL`) solapa con la política de lectura general en `SELECT`. Partirla en políticas separadas por comando eliminaría el solape, pero es una ganancia marginal en tablas de baja cardinalidad; se prioriza esquema simple.
- `pg_net` instalado en `public` — la extensión no soporta `ALTER EXTENSION SET SCHEMA`; venía preinstalada en el proyecto reutilizado, no la creamos nosotros.
- Protección de contraseñas filtradas desactivada — no aplica: la única autenticación es Google OAuth, sin contraseñas.

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
