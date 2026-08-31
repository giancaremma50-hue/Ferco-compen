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

## Rendimiento de RLS

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
