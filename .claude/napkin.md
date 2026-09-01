# Napkin Runbook — ATS
_Última actualización: 2026-09-01 (Fase 12)_

## Plantillas de mensaje + correo directo al candidato (Fase 12) — MÁXIMA PRIORIDAD

1. **[2026-09-01] `application_event_type` ya tenía el valor `correo_enviado` desde el diseño original del esquema, sin ningún código que lo insertara — confirmado por grep antes de escribir la Server Action.**
   El schema fue diseñado anticipando esta feature (Fase 6 dejó el enum listo) pero nunca se cableó hasta ahora. Do instead: antes de decidir que un enum "no se usa" o está muerto, comprobar con grep si de verdad no hay ningún productor — puede ser una feature futura ya prevista, no basura.

2. **[2026-09-01] El destinatario del correo sale SIEMPRE de la fila (`applications.candidates.email`), nunca de un campo del formulario — variante nueva del patrón IDOR de esta sesión.**
   A diferencia de los 5 casos anteriores (un id de OTRA fila que no se revalida), acá el riesgo es distinto: si el "to" viniera del cliente, cualquiera con acceso de escritura a la acción podría mandar un correo con remitente de esta plataforma a una dirección arbitraria (vector de phishing), no solo leer/escribir datos ajenos. Do instead: en cualquier acción que envía correo a un tercero (no un perfil interno), el destinatario se resuelve siempre server-side desde la fila que la acción ya tiene permiso de leer — jamás se acepta como parámetro, ni siquiera oculto en un campo hidden.

3. **[2026-09-01] Un `<textarea>` manda saltos de línea como `\r\n` en el FormData — `body.split("\n")` sin normalizar deja un `\r` colgando en cada línea salvo la última.**
   Encontrado por revisión línea-por-línea antes de llegar a producción. Do instead: cualquier código que haga `split("\n")` sobre texto que vino de un `<textarea>` (o cualquier input HTML multilínea) debe normalizar con `.replace(/\r\n/g, "\n")` primero — no asumir que el navegador manda `\n` puro.

4. **[2026-09-01] Precedente confirmado (no bug): reusar un permiso "de decisión" (`canDecideApplication`) para una acción nueva (enviar mensaje) puede dar a un `colaborador` con tier `approver`/`owner` una capacidad que la UI no expone a su rol — pero esto ya era así para Contratar/Rechazar/Tareas, no es una regresión nueva.**
   El gate de UI (`profile.role !== "colaborador"`) y el permiso real de servidor (`canDecideApplication`, que sí deja pasar a un colaborador con tier alto en `job_collaborators`) llevan divergiendo desde Fase 5 — es el modelo de acceso fino documentado en AGENTS.md ("el acceso fino se resuelve con `job_collaborators`, no subiendo el rol global"), no un hueco. Do instead: antes de "corregir" una discrepancia UI-vs-servidor en este proyecto, comprobar si YA es el patrón aceptado en pantallas hermanas (Contratar/Rechazar) antes de tratarla como bug nuevo.

5. **[2026-09-01] Tres páginas de configuración con lista simple (`motivos-rechazo`, `pipelines`, ahora `plantillas-mensaje`) habían llegado a tener el mismo `loading.tsx` copiado a mano — extraído a `<ConfigListSkeleton />` recién en la 3ª repetición.**
   Do instead: la regla "tres líneas similares > abstracción prematura" aplica a *código nuevo* que se parece a algo existente — pero si el código NUEVO sería la 3ª copia casi idéntica de algo que YA se duplicó una vez antes, esa es la señal real de extraer, no de aceptar una 3ª duplicación.

---

## Evaluación por competencias (Fase 11) — MÁXIMA PRIORIDAD

1. **[2026-09-01] BUG REAL, encontrado por un agente con acceso directo a Supabase (no solo lectura de código): `UPDATE`/`DELETE` de `application_competency_scores` no revalidaban acceso a la vacante, solo `evaluator_id = auth.uid()`.**
   A diferencia de `SELECT`/`INSERT` (que sí exigen `can_access_job`), un evaluador al que se le quita el acceso (deja de ser `job_collaborator`) podía seguir tocando su calificación vieja. Corregido con una migración que agrega el mismo `EXISTS(...can_access_job...)` a ambas políticas. Verificado con simulación de rol real: se quita el `job_collaborator`, se intenta `UPDATE`, 0 filas afectadas.
   Do instead: cuando una tabla nueva tiene SELECT/INSERT con un chequeo (ej. `can_access_job`) y UPDATE/DELETE con otro más simple (ej. solo "soy el dueño de la fila"), preguntarse explícitamente si ese chequeo más simple debería incluir también el primero — no asumir que "ya es mi fila" es suficiente si el permiso subyacente (acceso a la vacante) pudo cambiar después de crearla.

2. **[2026-09-01] BUG REAL (4ª vez esta sesión, variante nueva): `submitScore` nunca validaba que `competencyId` perteneciera a la MISMA vacante que `applicationId`.**
   A diferencia de las 3 veces anteriores (un id de OTRA fila del mismo tipo, ej. otro perfil), acá son dos ids de tablas DISTINTAS que deben coincidir en un campo compartido (`job_id`) sin que ninguna FK lo obligue — ninguna restricción de base de datos liga `application_competency_scores.application_id` con `.competency_id` a través de un `job_id` común. Do instead: cuando dos columnas de una misma fila referencian tablas distintas que a su vez comparten un campo "padre" (aquí, `job_id`), y no hay una FK compuesta que lo fuerce, la Server Action tiene que leer y comparar ese campo compartido a mano antes de escribir — mismo principio que "un id hijo no prueba pertenencia al padre correcto" (Fase 5), pero entre dos hijos del mismo padre, no un hijo y su padre.

3. **[2026-09-01] BUG REAL, encontrado por línea-por-línea: una `key` de React compartida entre postulaciones distintas puede filtrar estado de un candidato a otro.**
   `CompetencyRow` se keyeaba solo por `competencyId` (pertenece a la VACANTE, no a la postulación) — dos candidatos de la misma vacante comparten esa key. Al navegar de un candidato a otro (misma vacante), React podía reciclar la instancia del componente y su estado local (la calificación en progreso), dejando que se guardara la nota de un candidato sobre otro.
   Do instead: cuando un componente de cliente muestra datos de una entidad (aquí, competencia) que en realidad pertenece a un padre compartido (la vacante) pero se renderiza en el contexto de un hijo específico (la postulación/candidato), la `key` de React tiene que incluir el id del hijo, no solo el de la entidad compartida — aunque la entidad compartida ya tenga su propio id único.

4. **[2026-09-01] Decisión: `position` de `job_competencies` se simplificó a un valor fijo (0), ordenando por `created_at`.**
   El primer intento calculaba `position` con un `COUNT` antes de cada insert — sin constraint de unicidad, esto colisiona de forma determinística después de un borrar+agregar (no hace falta concurrencia para reproducirlo). Como no existe todavía un reordenamiento manual de competencias, no hay ninguna razón para mantener un valor calculado que nadie lee de forma ordenada — se resuelve solo con orden de creación. Si se agrega reordenamiento después, ahí sí vale la pena un `position` real mantenido (con el mismo patrón "reemplazar todo" que `pipeline_templates`).

5. **[2026-09-01] Pendiente, documentado a propósito: el peso (`weight`) de cada competencia se captura y se muestra, pero no se usa todavía para calcular un puntaje global ponderado de la postulación.**
   Hoy cada competencia solo muestra su propio promedio simple entre evaluadores; no existe un "puntaje total" que combine las competencias usando su peso. Es una limitación conocida, no un bug — construirlo bien necesita decidir dónde mostrarlo y qué hacer cuando faltan calificaciones en algunas competencias, y no se improvisó en esta fase.

---

## Tareas del candidato (Fase 10) — MÁXIMA PRIORIDAD

1. **[2026-09-01] Primera tabla nueva desde Fase 2 — `candidate_tasks`, migrada con `apply_migration` sin bloqueo del clasificador de auto-modo.**
   A diferencia del `ALTER TYPE ADD VALUE` bloqueado en Fase 7, un `CREATE TABLE` + RLS completo pasó sin pedir aprobación extra. No hay un patrón claro de qué bloquea el clasificador — no asumir que DDL "grande" se bloquea más que DDL "chico"; cada intento es su propio caso.

2. **[2026-09-01] Verificación de RLS con simulación de rol encontró un falso positivo por mal diseño de la prueba, no un bug real — anotar el error para no repetirlo.**
   Primera prueba: reutilicé el mismo perfil real (el único que existe en esta demo) como `requested_by` de la vacante Y como el "colaborador ajeno" que se probaba — `can_access_job` daba `true` correctamente (sí era el requester), pero yo esperaba `false`. Parecía un hueco de seguridad grave ("cualquiera puede insertar tareas").
   Do instead: para probar "colaborador sin ninguna relación", la vacante de prueba necesita `owner_id`/`requested_by` en `null` explícito (bypasear RLS con el rol default de la conexión SQL para el setup, no con `set role authenticated`) — nunca reusar el único perfil real disponible como "el ajeno" a la vez que como dueño de los datos de prueba.

3. **[2026-09-01] BUG REAL (mismo patrón, 3ª vez esta sesión): `assigned_to` de una tarea no se validaba contra la gente con acceso real a la vacante antes de insertar.**
   El `<select>` del formulario (`task-form.tsx`) ya solo ofrece gente con `can_access_job` (admin+ o colaborador de esa vacante) — la Server Action `addTask` confiaba en eso sin revalidar. Mismo hueco que `job_collaborators` (Fase 8) y `head_profile_id` de departamentos (Fase 9).
   Do instead: **cualquier id que salga de un `<select>` filtrado en el cliente se re-valida server-side, siempre, sin excepción** — a estas alturas esto debería ser un reflejo antes de escribir la Server Action, no un hallazgo de `/code-review`. Ver `isProfileAssignable()` en `src/lib/applications/get-applications.ts`.

4. **[2026-09-01] Las secciones nuevas de una página deben heredar el mismo gate de rol que las secciones vecinas, no asumir "RLS ya lo esconde".**
   La sección de Tareas se agregó sin la misma condición `profile.role !== "colaborador"` que ya protege Contratar/Rechazar en la misma página — un colaborador que ve la postulación solo por haber referido al candidato (no por `can_access_job`) habría visto un formulario que RLS le bloquea en silencio, sin explicación. Do instead: cuando una pantalla ya tiene un gate de visibilidad para un rol, cualquier sección nueva en esa misma pantalla hereda el mismo gate por defecto, salvo razón explícita para no hacerlo.

5. **[2026-09-01] Una consulta nueva y menos probada nunca debe compartir `Promise.all` con datos ya estables de los que depende el resto de la página.**
   `getAssignableProfiles` (recién escrita) se metió en el mismo `Promise.all` que la consulta de `rejection_reasons` (ya estable) — si la nueva fallaba, tumbaba toda la página (CV, notas, calificación, todo). Do instead: envolver la consulta nueva en `.catch(() => valorDeRespaldo)` cuando su fallo no debería impedir que el resto de la página cargue.

---

## Configurador simple: Departamentos, Pipelines, Motivos de rechazo (Fase 9)

1. **[2026-09-01] `email_templates` quedó fuera de Fase 9 a propósito — no se construyó su CRUD.**
   Motivo: nada en el código lee esa tabla todavía (los correos siguen hardcodeados en React Email desde Fase 6). Un CRUD para una tabla que nadie consume es peor que no construirlo — miente sobre tener efecto. Do instead: cuando se aborde, hacerlo junto con wirear `notify()`/`sendEmail()` para leer de ahí, no antes.

2. **[2026-09-01] El patrón "diálogo repetido" cruzó el umbral de 3 a 4 copias — esta vez sí se extrajo `<DialogShell>` (`src/components/ui/dialog-shell.tsx`).**
   Antes: `report-error-dialog.tsx` (Fase 7) y `reject-dialog.tsx` (Fase 5) ya lo tenían flagueado en reviews previos como "no urgente, 2-3 copias". Al aparecer una 4ª (`department-dialog.tsx`), el propio agente de reuso lo marcó como punto de quiebre. Do instead: 2-3 copias del mismo chrome se documentan y se dejan; a la 4ª, extraer — no hay una regla numérica mágica, pero repetirlo un review tras otro sin actuar es la señal real.

3. **[2026-09-01] BUG REAL (mismo patrón de Fase 8): `head_profile_id` de un departamento no se validaba contra la organización del actor antes de escribir.**
   El `<select>` del formulario ya solo lista gente de la org, pero la Server Action confiaba en el valor del cliente. Ver `assertProfileInOrg()` en `src/lib/departments/actions.ts` — mismo helper conceptual que Fase 8 para `job_collaborators`. Do instead: cualquier id que el cliente eligió de un `<select>` filtrado por organización se revalida server-side igual, sin excepción — ya es la segunda vez que aparece este mismo hueco en fases consecutivas.

4. **[2026-09-01] Aceptado, no corregido: `updatePipelineTemplate`/`createPipelineTemplate` borran+reinsertan las etapas sin transacción — ventana real de "plantilla con 0 etapas" si el insert falla justo después del delete.**
   Mismo patrón ya usado en el proyecto para listas anidadas (preguntas/etapas de vacante) — se acepta el mismo trade-off aquí. Corregirlo de verdad requiere una función RPC en Postgres que envuelva ambas operaciones en una transacción real (el cliente de Supabase JS no hace transacciones multi-statement). No se atacó esta sesión — bajo tráfico de escritura en esta pantalla, y cualquier fallo deja un estado detectable (plantilla con 0 etapas, mensaje de error visible), no uno silencioso.

5. **[2026-09-01] Aceptado, no corregido: `setDefaultPipelineTemplate` hace 2 UPDATEs secuenciales (quitar default viejo, poner default nuevo) sin transacción — ventana de "cero plantillas default" si el proceso se interrumpe entre los dos.**
   Mismo motivo que el punto anterior (necesita RPC/transacción real). Si `materializeJobStages()` corre justo en esa ventana, el `.single()` no encuentra fila y el gestor ve "No hay una plantilla de pipeline configurada" — mensaje amigable ya existente, no un crash. Riesgo real bajísimo: un solo admin activo hoy, acción rara.

6. **[2026-09-01] `deletePipelineTemplate` sí se corrigió con compare-and-swap: el chequeo `is_default=false` va en el propio `.eq()` del DELETE, no en un SELECT previo.**
   Mismo patrón que las transiciones de estado de vacantes/postulaciones — evita la carrera "SELECT ve false, otro admin lo marca default, DELETE de todos modos" sin necesitar ninguna migración nueva.

---

## Colaboradores por vacante + Bitácora (Fase 8) — MÁXIMA PRIORIDAD

1. **[2026-09-01] Todo el mecanismo RLS de `job_collaborators` ya existía completo desde Fase 2 — `can_access_job()` ya lo usa en `jobs`/`job_stages`/`applications`. Fase 8 fue 100% UI + capa de app, cero migración.**
   `private.can_access_job(job_id)` = admin+ OR owner/requested_by OR fila en `job_collaborators`. Ya estaba wireado en `jobs_select_internal`, `job_stages_select`, `applications_select/insert/update`. Lo único que faltaba: pantalla para agregar/quitar colaboradores (gateada a admin+ por `job_collaborators_write_admin`).

2. **[2026-09-01] BUG REAL encontrado en `/code-review`: un atajo "sin cambios" antes del chequeo de permiso deja pasar sin autorizar.**
   `moveApplicationStage` tenía `if (fromStageId === toStageId) return {success}` ANTES de validar `canDecideApplication`. No mutaba nada, pero el invariante "toda la función valida permiso" se rompía por ese único camino.
   Do instead: el chequeo de permiso/autorización va SIEMPRE antes de cualquier atajo de "no-op", nunca después — un atajo de conveniencia es fácil de escribir arriba del todo sin pensar que también hay que autorizarlo.

3. **[2026-09-01] BUG REAL (IDOR), encontrado en `/code-review`: agregar un colaborador no validaba que la persona elegida fuera de la misma organización.**
   El `<select>` del panel ya solo lista gente de la org, pero la Server Action confiaba en el `profile_id` que llegara en el FormData sin comparar organización — el cliente nunca es fuente de verdad, ni siquiera cuando la UI ya filtra.
   Do instead: antes de cualquier INSERT con un id que el cliente eligió de un `<select>`, revalidar server-side que esa fila (aquí, el perfil) pertenece a la misma organización que el actor — el mismo patrón que "un id hijo no prueba pertenencia al padre" de Fase 5.

4. **[2026-09-01] RESUELTO (con permiso explícito del usuario): los niveles de `job_collaborators.permission` ahora se hacen cumplir también en Postgres, no solo en la Server Action.**
   RLS (`can_access_job`) sigue sin distinguir nivel — a propósito, sigue gobernando visibilidad. Lo nuevo es un **trigger** `enforce_application_permission_tiers` (`BEFORE UPDATE` en `applications`) que llama a `private.can_decide_application(job_id)`/`private.can_rate_application(job_id)` — espejo exacto (mismo `auth_role() <> 'colaborador' OR EXISTS(...)`) de `canDecideApplication`/`canRateApplication` en `src/lib/applications/permissions.ts`. Si cambian los umbrales en TypeScript, hay que replicar el cambio en las dos funciones SQL o quedan desincronizadas — no hay una sola fuente de verdad todavía (aceptado por ahora, es demo).
   Verificado con simulación real de rol (`set_config('request.jwt.claims',...)` + `set role authenticated`, transacción con rollback, patrón ya documentado arriba): viewer bloqueado en decidir Y calificar, interviewer puede calificar pero no decidir, approver puede ambas — los 3 casos junto con el trigger disparando de verdad (no solo la función aislada).
   Do instead (si se toca de nuevo): correr la misma simulación de rol antes de dar por buena cualquier política/trigger nuevo — no alcanza con leer el SQL.

5. **[2026-09-01] `audit_log` tiene el mismo hueco de organización que `error_reports` (Fase 7) — mismo mitigante.**
   `audit_log_select_super_admin` es solo `is_super_admin()`, sin `organization_id`. `getAuditLog()` filtra en la app. Ver el ítem de Fase 7/Supabase-RLS arriba — es el mismo patrón repetido, no una fuga nueva.

---

## Demo genérica — sin marca real (2026-09-01)

Por indicación del usuario, el repo y los datos de demo NO deben identificar a
ninguna empresa real.

- **Nombre de producto**: `organizations.platform_name = 'Atrio'` (ya usado en
  los mockups de `design/*.dc.html` — solo faltaba escribirlo en la fila real).
  `organizations.name = 'Mi Empresa'` (genérico, sin cambios). `accent_color`
  y `allowed_email_domain` ya eran genéricos/`null`.
- **Logo**: no se sube ningún archivo. El fallback ya existente (cuadro con
  borde + primera letra de `platform_name`, en `login/page.tsx`,
  `app-header.tsx`) hace de "logo genérico" con cero assets nuevos — no
  inventar un logo de imagen, ese fallback YA es el logo.
- Se borraron `public/logo-blanca.png`/`logo-negro.png` — eran el logo real de
  un cliente (Ferco Cerámica), commiteados sin uso en el código (`grep` no
  encontró ningún import). **Siguen en el historial de git** de commits
  anteriores a esta limpieza — borrar eso de verdad requiere reescribir
  historia (`git filter-repo`/BFG + force-push), una operación destructiva que
  no se hizo sin pedirla explícita.
- Se cambió `es-GT`/"Guatemala"/"Centroamérica" por `es`/genérico en 4 sitios
  de formateo de fecha y 2 comentarios (`today-label.tsx`, `greeting.tsx`,
  `application-timeline.tsx`, `note-list.tsx`, `configuracion/errores/page.tsx`)
  — no había ninguna dependencia real de esa configuración regional, solo texto
  de ejemplo/locale hardcodeado.
- `docs/database.md`/napkin mencionan `V1-motoslam` como nombre del proyecto de
  Supabase — es un codename interno de OTRO proyecto reutilizado, no tiene
  relación con ninguna empresa real; no hace falta cambiarlo.
- El repositorio de GitHub ya se renombró a `demo-ats` (antes `Ferco-compen`) —
  hecho fuera de esta sesión, confirmado al hacer push.
- No tocado sin permiso explícito: `context-ats-reclutamiento.md` (fuera de
  este repo, en el directorio padre, describe un sistema legado distinto).

---

## Reglas de Curación
- Re-priorizar en cada lectura. Máximo 10 ítems por categoría.
- Es bitácora de registro: no solo trampas de sintaxis, también decisiones no obvias y errores reales con su corrección. Incluir fecha + "Do instead".
- **Leer ANTES de tocar código.**

---

## Límite del entorno de desarrollo remoto (no es un bug)

1. **[2026-08-31] `npm run dev` en este sandbox NO puede llamar a `*.supabase.co` directo — solo el MCP de Supabase tiene canal permitido.**
   Síntoma: cualquier página que dependa de datos de Supabase (branding, sesión) los recibe como `null` al probar con curl/Playwright contra el dev server local, aunque el código y la política RLS estén correctos (verificado por separado con SQL directo vía MCP). El error real es `"Host not in allowlist: <ref>.supabase.co"`.
   Do instead: verificar la lógica por inspección + typecheck/build + SQL directo contra la base (vía MCP), no por curl/Playwright al dev server para nada que dependa de red hacia Supabase. En producción (Vercel) esto no aplica — tiene salida a internet real. No perder tiempo intentando arreglarlo como si fuera un bug de la app.

2. **[2026-09-01] Puede haber DOS conectores MCP de Supabase a la vez, uno de ellos apuntando a un proyecto que NO es este.**
   Síntoma real: el conector `mcp__supabase__*` (sin `project_id` como parámetro, pinneado a un solo proyecto) resolvió a `cihcimdzwlmhedpprmhf` — un proyecto legado ajeno (nombres de política en español, `is_administrador()`) — mientras el proyecto real de este repo es `cgudnnlcwcotovcslgzu` ("V1-motoslam", ver `docs/database.md`). El conector correcto para este repo es el que SÍ acepta `project_id` en cada tool (`list_projects`/`execute_sql`/`apply_migration` con ese parámetro) — permite elegir el proyecto explícito por `list_projects()` en vez de confiar en cuál quedó pineado por la cuenta.
   Do instead: antes de la PRIMERA query o migración de una sesión nueva, correr `get_project_url()` (o `list_projects()` + comparar el `ref`) y confirmarlo contra `cgudnnlcwcotovcslgzu` — nunca asumir que "el MCP de supabase" conectado es el de este repo solo porque el nombre de la tool coincide.

3. **[2026-09-01] `apply_migration` (DDL) contra este proyecto es bloqueado por el clasificador de auto-modo, incluso para un cambio aditivo y trivial (`ALTER TYPE ... ADD VALUE`).**
   Do instead: no asumir que cualquier feature nueva necesita su propia migración — reutilizar un enum/columna ya existente si el caso de uso lo permite (ver Fase 7 abajo). Si de verdad hace falta DDL, ese paso queda pendiente de aprobación explícita del usuario en el chat, no se reintenta con otra forma de saltarlo.

4. **[2026-09-01] Este worktree no trae su propio `node_modules` — un git worktree nuevo necesita `npm install` propio antes de poder correr `next build`.**
   Síntoma engañoso: `npm run typecheck`/`npm run lint` corren bien SIN `node_modules` local porque Node resuelve `tsc`/`eslint` subiendo a un `node_modules` ancestro (otro worktree/repo principal) — pero `next build` (Turbopack) restringe la resolución de paquetes a la raíz del workspace detectado y falla con "Could not find the Next.js package" aunque el resto compile.
   Do instead: si typecheck/lint pasan "sospechosamente rápido" en un worktree recién creado, no dar por bueno el build sin correrlo — `npm install` primero si no hay `node_modules` local.

---

## ⚠️ Pasos manuales pendientes fuera de este entorno (revisar antes de cada release)

1. **[2026-08-31] Activar el custom access token hook en el Dashboard de Supabase.**
   Authentication → Hooks → "Customize Access Token (JWT) Claims hook" → seleccionar `public.custom_access_token_hook`. Sin esto, `private.auth_role()`/`auth_org_id()` devuelven `null` y casi toda política RLS deniega todo (hay un fallback para ver el propio perfil, ver más abajo, pero nada más).

2. **[2026-08-31] Habilitar el proveedor de Google en Supabase Auth.**
   Authentication → Providers → Google: crear un OAuth Client ID/Secret en Google Cloud Console con el redirect URI `https://cgudnnlcwcotovcslgzu.supabase.co/auth/v1/callback`, y pegarlos ahí. Sin esto, `signInWithOAuth({ provider: "google" })` falla y el login no funciona en absoluto — se probó todo lo demás (redirecciones, RLS, diseño) sin este paso porque no se puede automatizar desde aquí.

---

## Supabase / RLS — decisiones y errores reales (MÁXIMA PRIORIDAD)

1. **[2026-08-31] Proyecto reutilizado: `V1-motoslam` (ref `cgudnnlcwcotovcslgzu`), no uno nuevo.**
   Do instead: era un sistema de vacaciones "PCG" sin uso, confirmado por el usuario y borrado por completo (tablas, tipos, función `rol_actual()`, políticas de storage) antes de crear el esquema del ATS. Queda un bucket `archivos` con 1 objeto huérfano que no se pudo borrar por SQL (`Direct deletion from storage tables is not allowed`) — pendiente de borrado manual por el usuario, no interfiere con el ATS.

2. **[2026-08-31] BUG REAL: recursión infinita (42P17) entre las políticas de `candidates` y `applications`.**
   Causa: `candidates_select` hacía `EXISTS` sobre `applications`, y `applications_select` hacía `EXISTS` sobre `candidates` — cada tabla dispara la política RLS de la otra en un ciclo.
   Do instead: cuando dos tablas se referencian mutuamente dentro de sus políticas, envolver una de las dos consultas en una función `SECURITY DEFINER` en `private` (aquí: `candidate_has_accessible_application`, `candidate_referred_by_me`). Al ser las tablas propiedad de `postgres` sin `FORCE ROW LEVEL SECURITY`, la función ejecuta como su dueño y no re-dispara RLS. Se encontró simulando JWTs reales por rol, no leyendo el SQL — **toda política nueva se prueba así antes de darla por buena**.

3. **[2026-08-31] Rol y organización viajan en el JWT vía custom access token hook — requiere un paso manual fuera del MCP.**
   Do instead: la función `public.custom_access_token_hook` ya existe en la base, pero Supabase Auth no la invoca hasta que alguien la selecciona en Dashboard → Authentication → Hooks → "Customize Access Token (JWT) Claims hook". Sin ese clic, `private.auth_role()`/`auth_org_id()` devuelven `null` para todos y **todas las políticas RLS deniegan todo**. Verificar esto primero si algo "no debería estar vacío pero lo está" en la Fase 3.

4. **[2026-08-31] `private.*()` sin argumentos siempre envueltas en `(select ...)` dentro de USING/WITH CHECK.**
   Do instead: `(select private.auth_org_id())`, `(select auth.uid())`, etc. — si no, Postgres las re-evalúa fila por fila (advisor `auth_rls_initplan`). Las que sí toman una columna de la fila como argumento (`can_access_job(id)`) se dejan tal cual, no hay nada que precalcular.

5. **[2026-08-31] Storage: DELETE directo sobre `storage.objects`/`storage.buckets` está bloqueado por Postgres (`storage.protect_delete()`).**
   Do instead: para borrar buckets u objetos hace falta la Storage API con `service_role_key`, no SQL. INSERT sí funciona directo (así se crearon `marca-publico` y `cvs-privado`).

6. **[2026-08-31] Extensión `pg_net` no soporta `ALTER EXTENSION ... SET SCHEMA`.**
   Do instead: si el advisor de seguridad marca "Extension in Public" para `pg_net`, no intentar moverla — falla con `0A000`. Dejarla y documentar como aceptada si no la instalamos nosotros.

7. **[2026-08-31] `profiles` necesita una política de "ver mi propia fila" independiente del JWT hook.**
   Do instead: `profiles_select_own using (id = (select auth.uid()))`, separada de `profiles_select_org` (que depende de `auth_org_id()`). Si no existe, nadie puede leer ni su propio perfil mientras el hook del paso manual #1 no esté activado — se rompe el callback de login completo.

8. **[2026-08-31] "No dejar la organización sin super admin" necesita defensa en dos capas, no una.**
   Causa: un chequeo optimista en el Server Action (`wouldRemoveLastSuperAdmin`, lee el conteo antes del UPDATE) tiene una carrera real entre dos requests concurrentes que pasan el conteo antes de que cualquiera confirme.
   Do instead: la capa que de verdad protege es un trigger `BEFORE UPDATE` en `profiles` (`private.guard_last_super_admin`) con `pg_advisory_xact_lock(hashtext(organization_id::text))` antes de contar — serializa las transacciones concurrentes sobre la misma organización. El chequeo en el Server Action solo existe para dar un mensaje de error específico en el caso normal (no concurrente); si el trigger es quien bloquea, el usuario ve el mensaje genérico "No se pudo actualizar" — aceptable, la integridad de datos no depende del mensaje.

9. **[2026-08-31] BUG REAL: un login rechazado (perfil faltante o dominio no permitido) deja un `auth.users` huérfano que bloquea reintentos para siempre.**
   Causa: `handle_new_user` es un trigger `AFTER INSERT` en `auth.users` — solo se dispara una vez, al crear la cuenta. Si el callback rechaza esa sesión sin borrar la cuenta, un reintento de login reutiliza la misma fila de `auth.users` (no hay INSERT nuevo) y el trigger nunca vuelve a correr.
   Do instead: en **todo** camino de rechazo post-login (perfil faltante, dominio no permitido, inactivo no cuenta porque ahí sí hay perfil válido) llamar `createAdminClient().auth.admin.deleteUser(user.id)` antes de redirigir a la página de error — no solo en el caso que se te ocurrió primero. Se encontró porque un review notó que solo la rama de dominio-rechazado borraba la cuenta.

10. **[2026-09-01] BUG REAL (pendiente, no corregido): `error_reports_select`/`error_report_messages_select` no validan `organization_id` en la rama `is_super_admin()`.**
    Causa: la política es `reporter_id = auth.uid() OR is_super_admin()` — `private.is_super_admin()` solo mira el rol del JWT, nunca la organización. Hoy sin impacto real (un solo tenant), pero es el mismo patrón de fuga cross-tenant que la regla de AGENTS.md pide evitar.
    Do instead (cuando se apruebe una migración): agregar `organization_id = (select private.auth_org_id())` a ambas políticas. Mientras tanto, Fase 7 lo mitiga filtrando `organization_id` explícito en cada función de `src/lib/errors/get-error-reports.ts` y `src/lib/errors/actions.ts` — mitigación de capa de app, no reemplaza el fix real en la política.

---

## Vacantes y postulación (Fase 4) — MÁXIMA PRIORIDAD

1. **[2026-08-31] BUG REAL, crítico: la ruta de Storage del CV no coincidía con lo que la política RLS de `storage.objects` espera — encontrado al empezar Fase 5, no en Fase 4.**
   Causa: `cvs_privado_select`/`cvs_privado_delete` (creadas en Fase 2) exigen que el **segundo** segmento de la ruta sea el `candidate_id` (`private.can_access_candidate((storage.foldername(name))[2]::uuid)`). El Route Handler de Fase 4 subía el CV a `{organization_id}/{email}/{timestamp}.pdf` — el segundo segmento era un correo, no un UUID. Cualquier intento real de leer o firmar esa URL habría fallado (el cast `::uuid` de un email lanza una excepción de Postgres), dejando el control de acceso a CVs completamente roto desde el primer commit de Fase 4, sin que nada en el flujo de postulación lo hiciera evidente (subir y crear seguían funcionando).
   Do instead: **antes de subir cualquier archivo a un bucket privado, leer la política RLS de `storage.objects` para ese bucket y confirmar el formato de ruta exacto que espera** (`storage.foldername(name)` da un array; su índice depende de qué escribió la política, no de lo que parezca lógico). Aquí significó resolver/crear el candidato ANTES de subir el CV (no después), para poder construir la ruta con su id real — ver `findOrCreateCandidate`/`createApplicationForCandidate` en `src/lib/jobs/create-application.ts`.

2. **[2026-08-31] BUG REAL, crítico: usar el cliente de sesión para leer tablas admin-only rompe el flujo principal del producto.**
   Causa: `materializeJobStages()` (copia la plantilla de pipeline al crear una vacante) usaba el cliente de sesión del actor. `pipeline_templates` y `job_stages` solo tienen políticas de escritura/lectura para `admin+` (`pipeline_templates_admin`, `job_stages_write_admin`) — un `gestor` puede crear su propia vacante (RLS de `jobs_insert` sí lo permite), pero su `SELECT` a `pipeline_templates` siempre vuelve vacío. Resultado: **todo gestor que solicitaba una vacante recibía "No hay una plantilla de pipeline configurada"**, aunque sí existiera — el caso de uso principal del producto ("gestor solicita plazas") estaba roto en Fase 4 desde el primer commit.
   Do instead: cualquier operación que necesite una verdad de la organización que no dependa de lo que el actor de turno puede ver por RLS (copiar una plantilla, deduplicar un candidato por correo) usa `createAdminClient()` internamente, sin importar qué cliente pasó el llamador — nunca asumir que "ya está autenticado" es suficiente para leer una tabla que RLS reserva a otro rol. Antes de dar una función por buena, simular con el rol de menor privilegio que la va a usar de verdad (aquí: `gestor`, no `admin`).

3. **[2026-08-31] Deduplicar por email con `.ilike()` es un bug, no una mejora — `%` y `_` son comodines de SQL.**
   Do instead: usar siempre `.eq("email", email)` (con el email ya en minúsculas) para un lookup de igualdad exacta. `ilike` solo tiene sentido para búsquedas de texto libre, nunca para una clave de deduplicación — un correo con `_` (frecuentísimo en direcciones corporativas) puede matchear una fila completamente distinta.

4. **[2026-08-31] Un `.update(objeto)` de Supabase nunca puede *borrar* un campo si ese campo llega como `undefined`.**
   Causa: `JSON.stringify` omite las claves `undefined` antes de mandar el PATCH — Supabase nunca se entera de que existían. Con los preprocesadores de Zod que convierten `""` a `undefined` (patrón ya usado en Fase 2/3), un formulario de edición que "vacía" un campo opcional en realidad deja el valor viejo intacto en la base, con un toast de éxito engañoso.
   Do instead: normalizar explícitamente los campos opcionales a `null` (nunca dejarlos en `undefined`) justo antes de armar el objeto que se pasa a `.update()`/`.insert()`.

5. **[2026-08-31] Toda transición de estado compartido (aprobar/cancelar/publicar) necesita compare-and-swap, no solo "leer, validar, escribir".**
   Causa: dos clics casi simultáneos (dos pestañas, o un doble clic entre dos botones distintos que comparten el mismo `useTransition`) pueden ejecutar dos `UPDATE` sobre la misma fila después de que ambos leyeron el mismo estado "viejo" — el segundo pisa al primero en silencio, cada uno con su propio toast de éxito.
   Do instead: agregar `.eq("status", estadoQueSeLeyó)` al `UPDATE` (no solo `.eq("id", ...)`). Si la fila ya cambió, el `UPDATE` afecta 0 filas y el código ya trata eso como error — mismo patrón (más liviano) que el advisory lock de Fase 3 para el caso del último super admin.

6. **[2026-08-31] Un `UNIQUE` a nivel de aplicación (check-then-insert) siempre tiene una ventana de carrera — maneja el código `23505`, no solo el camino feliz.**
   Do instead: si el `INSERT` falla con `error.code === "23505"` justo después de que el `SELECT` de deduplicación no encontró nada, es casi seguro una carrera (doble clic, dos requests casi simultáneas) — volver a hacer el `SELECT` y usar esa fila en vez de fallar con un mensaje genérico. Aplica a cualquier dedup por email/slug construido como "buscar, si no existe crear".

7. **[2026-08-31] `published_at` solo se marca la primera vez que se publica, nunca en cada transición hacia "abierta".**
   Do instead: `if (!current.published_at)`, no `if (current.status !== "abierta")` — lo segundo reinicia la fecha cada vez que se reabre tras una pausa, y el portal público (ordenado por `published_at`) muestra una vacante de semanas como si fuera nueva.

8. **[2026-08-31] Todo validador de Zod en un formulario en español necesita su propio `{ error: "..." }` — incluso los que "seguro nunca van a fallar".**
   Causa: `.int()` sin mensaje propio, cuando `.positive()` sí lo tiene, deja pasar el texto default de Zod en inglés apenas alguien manda un valor no entero (posible con una llamada directa al endpoint, sin pasar por el `<input type="number">` del navegador).
   Do instead: revisar cada eslabón de una cadena Zod (`.int()`, `.min()`, `.max()`, `.positive()`, no solo el último), sobre todo en preprocesadores compartidos por varios campos (`optionalNumber` en `schema.ts`).

---

## Centro de errores (Fase 7) — MÁXIMA PRIORIDAD

1. **[2026-09-01] Ya existía infraestructura de bitácora genérica antes de Fase 7 — buscarla antes de inventar una nueva.**
   `private.audit_row_change(org_id, action, entity_type, entity_id, diff jsonb)` (SECURITY DEFINER) ya estaba escrita y ya hay un trigger real usándola (`audit_error_report_status` en `error_reports`, dispara en cada cambio de `status`). Fase 8 (bitácora) probablemente es solo la pantalla de lectura sobre `audit_log`, no construir el mecanismo de escritura desde cero.
   Do instead: antes de agregar logging/auditoría nueva a cualquier tabla, `select proname from pg_proc where prosrc ilike '%audit_log%'` primero.

2. **[2026-09-01] Contexto auto-capturado del navegador (mensaje de excepción, URL, user agent) se trunca ANTES de pasar por Zod, nunca después.**
   Causa: el límite de `ReportErrorSchema` está pensado para lo que escribe una persona (2000 caracteres es generoso para texto humano, corto para un `error.message` con causas anidadas o un stack serializado). Si se valida primero, el reporte del error real que se quiere reportar es exactamente el que falla el schema.
   Do instead: `truncate()` en `src/lib/errors/actions.ts` antes del `safeParse` — cualquier campo que venga de `window`/`navigator`/una excepción real, no de un `<input>` del usuario, se recorta antes de validar.

3. **[2026-09-01] Decisión consciente: un solo valor de enum `notification_type` (`respuesta_reporte_error`) cubre 3 direcciones distintas (reporte nuevo, respuesta de soporte, respuesta del reportante).**
   Motivo: agregar un segundo valor de enum es DDL, y el clasificador de auto-modo bloqueó incluso un `ALTER TYPE ... ADD VALUE` aditivo (ver categoría de arriba). Costo real: la preferencia de notificación es todo-o-nada para las 3 direcciones — un super admin no puede separar "avísame de reportes nuevos" de "avísame de respuestas en hilos que ya sigo".
   Do instead (si se aprueba una migración más adelante): dividir en 2-3 valores de enum reales y migrar `PREFERENCE_TYPES`/`NOTIFICATION_TYPE_LABEL` — no urgente mientras la organización tenga pocos super admin.

4. **[2026-09-01] Fase 7 no manda correo — solo notificación in-app.** Los `notify()` de `src/lib/errors/actions.ts` no pasan el campo `email`, a propósito: escribir las plantillas de React Email para "nuevo reporte"/"te respondieron" queda pendiente. El toggle de correo en Mis Preferencias para este tipo no hace nada todavía — no es un bug, pero si un review lo marca, la respuesta es "diseño, no falta terminar el campo".
   Do instead: si se pide correo real para esto, seguir el patrón de Fase 6 (`emails/`, `getEmailContext()`), no inventar uno nuevo.

---

## Notificaciones in-app y correo (Fase 6) — MÁXIMA PRIORIDAD

1. **[2026-09-01] BUG REAL, rompe el build: instanciar el SDK de un servicio externo a nivel de módulo revienta CUALQUIER página que lo importe, aunque sea indirecto.**
   Causa: `new Resend(process.env.RESEND_API_KEY)` a nivel de módulo en `send-email.ts` — si la key llega vacía (entorno sin Resend configurado todavía), el constructor lanza de inmediato. Como `notify.ts` importa `send-email.ts` y varias Server Actions (`jobs/actions.ts`, `applications/actions.ts`) importan `notify.ts`, **cualquier página que renderice esas Server Actions** (ni siquiera hace falta llamarlas) falla en `next build` con "Missing API key" al recolectar datos de la página.
   Do instead: nunca instanciar el cliente de un servicio externo (Resend, Stripe, etc.) a nivel de módulo si la app puede desplegarse sin esa key configurada — envolver la construcción en una función y crearlo perezosamente (memoizado con `??=`, no uno nuevo por llamada) solo cuando de verdad se va a usar. Se encontró al correr `npm run build` después de cablear los primeros disparadores reales de Fase 6, no en el commit que creó `send-email.ts` — probar el build completo, no solo `typecheck`, apenas un archivo nuevo entra en el grafo de imports de una página.

2. **`notifications` NO tiene política de INSERT para `authenticated` — a propósito, no es un descuido.**
   Do instead: `notify()` SIEMPRE usa `createAdminClient()`, nunca el cliente de sesión del actor que disparó el evento — casi nunca se notifica a uno mismo, y hay que leer la preferencia del DESTINATARIO, no la del actor.

3. **Un fallo al notificar/enviar correo nunca debe convertir una mutación ya exitosa en un error de cara al usuario — usar `after()` de Next, no solo un `try/catch` inline.**
   Causa real encontrada en `/code-review`: los primeros cuatro sitios que dispararon `notify()`/`sendEmail()` lo hacían con `await` normal justo antes del `return`/`NextResponse.json` — si `notify()` lanzaba (red, un render de React Email que falla), la Server Action/Route Handler entera fallaba pese a que el job/postulación/etapa ya había quedado guardado en la base.
   Do instead: envolver todo trabajo de notificación best-effort en un helper (`notifyBestEffort()` en `notify.ts`) que use `after()` (`next/server`, estable desde Next 15.1) para correr DESPUÉS de responder, con su propio `try/catch` + `console.error` (no silencioso del todo — hasta que exista Centro de errores en Fase 7). `after()` sí puede leer `headers()`/`cookies()` dentro de Server Actions y Route Handlers (no en Server Components).

4. **Habilitar Realtime en una tabla nueva requiere agregarla explícito a la publicación — no es automático.**
   Do instead: `alter publication supabase_realtime add table notifications;` (migración aparte). Sin esto, `.channel(...).on("postgres_changes", ...)` se suscribe sin error pero nunca recibe nada — no hay mensaje de fallo visible, solo silencio.

5. **Un listener de Realtime en UPDATE debe ser idempotente usando solo `payload.new` — `payload.old` no trae columnas completas salvo `REPLICA IDENTITY FULL`.**
   Do instead: si el propio código ya filtra las escrituras que disparan el evento (aquí: `markAsRead`/`markAllAsRead` solo tocan filas con `read_at is null`), cada UPDATE recibido ya implica una transición real — no hace falta diffear contra el valor viejo. Cuidado con doble-contar: si el mismo cliente ya actualizó su estado local de forma optimista (clic propio), el eco de Realtime que vuelve debe detectar que ya estaba contado (comparar contra el estado local) y no restar dos veces.

6. **Toda tabla con `organization_id` necesita que la política RLS lo valide contra el JWT, no solo el resto de columnas — aunque esas otras columnas ya sean suficientes para bloquear acceso cruzado.**
   Causa: `notification_preferences` se creó con `organization_id` pero la policy solo comprobaba `profile_id = auth.uid()` — sin exposición real (un `profile_id` ya pertenece a un solo org), pero viola la letra de la regla de AGENTS.md y deja una columna que un cliente arbitrario podría poblar con cualquier UUID.
   Do instead: `using (profile_id = (select auth.uid()) and organization_id = private.auth_org_id())`, igual en `with check` — mismo patrón que cualquier otra tabla org-scoped, sin excepción "porque total ya está protegida por otro lado".

7. **Gotcha ya documentado (Fase 3), reapareció igual: objeto con clave computada rompe el excess-property check de `.upsert()` tipado.**
   Do instead: `const channelUpdate: Partial<Record<"in_app" | "email", boolean>> = { [canal]: enabled }`, spread aparte — ver `preferences-actions.ts`. Sigue siendo la trampa más recurrente del proyecto con Supabase tipado.

8. **`mencion_nota` y `respuesta_reporte_error` existen en el enum `notification_type` pero no se disparan todavía.**
   Do instead: no armar un selector de preferencias para un tipo que nunca ocurre — `PREFERENCE_TYPES` los excluye a propósito. `mencion_nota` depende de un selector de @mención en `NoteForm` (no construido en Fase 5); `respuesta_reporte_error` es de Fase 7.

9. **Pendiente para Fase 8 (hardening), no bloqueante ahora: `getSiteUrl()` cae al header `Host` del request si falta `NEXT_PUBLIC_SITE_URL`, y Fase 6 empezó a usarlo desde `/api/postular` (ruta pública, sin sesión) para armar el link de "Ver la postulación" en el correo que le llega a RH.**
   Riesgo: si en producción se olvida configurar `NEXT_PUBLIC_SITE_URL`, un solicitante malicioso podría mandar un `Host` falso y que el correo interno de "nueva postulación" incluya un link de phishing. `getSiteUrl()` documenta que su único uso sensible conocido era `signInWithGoogle()` (protegido por la lista de Redirect URLs de Supabase) — ya no es cierto, revisar ese comentario al tocar Fase 8.
   Do instead en Fase 8: verificar que `NEXT_PUBLIC_SITE_URL` esté seteado en Vercel antes de desplegar, y considerar que `getSiteUrl()` rechace el fallback a `Host` para cualquier link que salga en un correo (no solo para el OAuth redirect).

---

## Pipeline y candidatos (Fase 5) — MÁXIMA PRIORIDAD

1. **[2026-08-31] BUG REAL: usar `!` sobre un join embebido de Supabase asume que RLS siempre lo deja pasar — a veces no.**
   Causa: `applications_select` deja ver una postulación a un colaborador que refirió al candidato (`candidate_referred_by_me`), sin exigir nada sobre el estado de la vacante. Pero `jobs_select`/`job_stages_select` sí exigen que la vacante siga pública+abierta o que el actor tenga acceso interno. Si la vacante se pausa o cierra después, ese mismo colaborador sigue viendo la postulación pero el `jobs(title)`/`job_stages(name)` embebido en el mismo `select()` vuelve `null` — `app.jobs!.title` truena con un `TypeError` en producción, justo el "stack crudo frente al usuario" que AGENTS.md prohíbe.
   Do instead: cuando dos tablas relacionadas en un mismo `.select()` tienen políticas RLS **distintas** (una más permisiva que la otra), el campo embebido de la tabla más restrictiva es opcional de verdad — tipar como `T | null`, usar `?.` y mostrar un texto de reemplazo ("Vacante no disponible"), nunca `!`. Antes de asumir que un join embebido siempre viene, comparar las políticas RLS de ambas tablas, no solo la de la tabla principal del `select()`.

2. **[2026-08-31] BUG REAL (forma de IDOR): un id que es clave primaria global (no particionada por padre) no prueba que la fila pertenezca al padre correcto.**
   Causa: `moveApplicationStage(applicationId, fromStageId, toStageId)` actualizaba `applications.stage_id` sin verificar que `fromStageId`/`toStageId` fueran etapas de la MISMA vacante que la postulación — `job_stages.id` es un UUID global, cualquier etapa de cualquier vacante de la organización es "válida" para el `UPDATE` mientras no se compare contra `job_id`. Una Server Action es un endpoint invocable por red, no solo lo que la UI de arrastre manda.
   Do instead: cuando un id de un recurso "hijo" (etapa, columna, ítem de catálogo) llega desde el cliente para actualizar un recurso "padre" (postulación, vacante), verificar explícitamente `SELECT ... WHERE id IN (...) AND parent_id = ?` antes del `UPDATE` — el tipo de la columna (UUID) no garantiza pertenencia al padre correcto, eso es una regla de negocio que hay que comprobar aparte.

3. **[2026-08-31] PostgREST convierte `*` en `%` para `ilike`/`like` ANTES de que Postgres vea el patrón — no se puede escapar con `\`.**
   Causa: es un alias documentado (evita tener que codificar `%` en la URL), pero significa que un término de búsqueda con un `*` literal se vuelve un comodín real sin que el backslash-escape de siempre (`\%`, `\_`, `\\`) lo evite — el alias ocurre en una capa anterior a donde el escape de SQL aplicaría.
   Do instead: para búsquedas de texto libre construidas con `.or("campo.ilike.%...%")`, quitar `*` del término del usuario (no intentar escaparlo) además de escapar `%`/`_`/`\` de la forma normal, y de quitar `,`/`(`/`)` (sintaxis de filtros de PostgREST). Tres capas de caracteres especiales distintas en una sola búsqueda — fácil olvidar una.

4. **[2026-08-31] El compare-and-swap de Fase 4 (`.eq("status", estadoViejo")`) se reusa tal cual para el drag-and-drop del kanban.**
   Do instead: `moveApplicationStage` agrega `.eq("stage_id", fromStageId)` al `UPDATE`, igual que las transiciones de vacante — dos arrastres simultáneos sobre la misma tarjeta (dos pestañas, o un evento de red que tarda) no se pisan en silencio, el segundo simplemente no afecta filas y se reporta como conflicto.

---

## Auth con Supabase + Next.js 16 (Fase 3)

1. **[2026-08-31] Tres clientes de Supabase, cada uno para su contexto — nunca mezclar.**
   Do instead: `src/lib/supabase/client.ts` (browser, `createBrowserClient`) para client components; `src/lib/supabase/server.ts` (`createServerClient` + `next/headers` cookies) para Server Components/Actions — respeta RLS; `src/lib/supabase/admin.ts` (service role) solo para el portal público y tareas de servidor sin sesión de usuario — nunca importarlo desde un client component.

2. **`proxy.ts` es un chequeo optimista; la autorización real vive en `src/lib/auth/dal.ts`.**
   Do instead: `getProfile()` memoizado con `cache()` de React + `import "server-only"`, y `requireProfile()`/`requireAdminOrAbove()`/`requireSuperAdmin()` que redirigen a `/login` o a `/auth/auth-error?motivo=sin_permiso` — nunca un 403 crudo. El proxy solo redirige rápido leyendo la cookie, sin tocar la base.

3. **`Server Action` con dos parámetros (`updateUserRole(userId, role)`) no sirve para `useActionState`.**
   Do instead: si el formulario necesita `useActionState`, la action recibe `(prevState, formData)` y el campo variable va como input oculto en el propio `formData` (así se hizo con `uploadBrandImage`). Para acciones disparadas por `onClick`/`onChange` fuera de un `<form>`, usar `useTransition` + una función normal (así se hizo con `updateUserRole`/`toggleUserActive`).

4. **`.update({ [campoVariable]: valor })` con Supabase tipado rompe TypeScript (excess property check).**
   Do instead: tipar el objeto explícito antes, `const update: Partial<Record<Campo, Tipo>> = { [campo]: valor }`, y pasar `update` al `.update()`.

5. **[2026-08-31] `react-hooks/set-state-in-effect` es un ERROR duro en este proyecto (rompe el build), no un warning — y no siempre se resuelve igual.**
   Do instead: si el estado que quieres resetear viene de una prop que cambió (ej. el formulario de marca cuando otra pestaña guarda), usa `key={prop}` en el padre para forzar un remount — el patrón oficial de React, sin `useEffect`. Si el estado es un valor genuinamente solo-de-cliente sin prop de la que depender (ej. `new Date()` para el saludo o la fecha de `/inicio` — el reloj del servidor en Vercel es UTC, no el de Centroamérica), no hay prop que "keyear": ahí sí toca `useEffect` + `// eslint-disable-next-line react-hooks/set-state-in-effect` con un comentario que justifique por qué. **Bug real encontrado con el primer patrón**: el `key` del formulario de marca solo incluía `accent_color`, así que un cambio de solo `platform_name` no remontaba el formulario y una pestaña vieja podía pisar el nombre nuevo al guardar — el `key` debe incluir TODAS las props de las que depende el estado interno, no solo la que se probó primero.

---

## Next.js 16 — Cambios de ruptura (MÁXIMA PRIORIDAD)

1. **[2026-08-31] `middleware.ts` NO EXISTE. Ahora se llama `proxy.ts`.**
   Do instead: archivo `proxy.ts` en la raíz del proyecto o dentro de `src/`, al mismo nivel que `app/`. Exporta `export function proxy(request: NextRequest)` o un default export. `export const config = { matcher: [...] }` sigue igual. **Toda la documentación de `@supabase/ssr` en internet dice `middleware.ts` — está desactualizada para Next 16.** Verificado en `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.

2. **[2026-08-31] Proxy corre en runtime de Node.js, no en Edge.**
   Do instead: se puede usar el SDK completo de Supabase dentro de `proxy.ts` sin preocuparse por compatibilidad con Edge. Solo leer la sesión de la cookie — **nunca consultar la base** desde el proxy, porque corre en cada ruta incluidas las prefetch.

3. **[2026-08-31] El proxy es un chequeo optimista, NO la capa de seguridad.**
   Do instead: la autorización real vive lo más cerca posible del dato: políticas RLS en Postgres + un Data Access Layer con `verifySession()` memoizado con `cache()` de React y `import 'server-only'` al inicio del archivo. El proxy solo redirige rápido.

3b. **[2026-08-31] `import "server-only"` no funciona si el paquete `server-only` no está instalado — Next NO lo trae solo.**
   Do instead: `npm install server-only` explícitamente. El build de Turbopack puede compilar igual sin él en algunos casos (alias interno), pero no depender de eso: instalarlo es el patrón documentado por Next.

3c. **[2026-08-31] `createServerClient` de `@supabase/ssr` en `proxy.ts`: toda redirección debe copiar las cookies de la respuesta que refrescó la sesión.**
   Do instead: `setAll()` reasigna `response` a un `NextResponse.next()` nuevo con las cookies puestas; si después decides redirigir, NO uses `NextResponse.redirect(url)` a secas — copia `response.cookies.getAll()` sobre la respuesta de redirect primero, o el refresh token recién rotado se pierde y el usuario entra en un loop de logout intermitente.

3d. **[2026-08-31] CVE de alta severidad: bypass de proxy/middleware en Turbopack (GHSA-6gpp-xcg3-4w24), corregido en Next 16.3.3.**
   Do instead: mantener Next en `^16.3.3` o superior. Se detectó vía `npm audit` mientras se construía `proxy.ts` — justo el mecanismo que el CVE afecta. Revisar `npm audit` en cada fase, no solo al final.

3e. **[2026-08-31] `organizations_select_public` es `using (true)` para `anon` Y `authenticated` — no depende del JWT hook.**
   Do instead: antes de asumir que un fallo de lectura en `/login` o en el callback de auth es "por el hook no activado todavía", verificar la policy real con `pg_policies`. Un review pasado marcó como bug que el login no podría leer `organizations` sin el hook — falso positivo, verificado contra la base real: esa tabla es pública por diseño para poder mostrar marca antes de iniciar sesión.

4. **[2026-08-31] `useActionState` devuelve `pending` — es la base de `<ActionButton>`.**
   Do instead: `const [state, action, pending] = useActionState(fn, initialState)`. No inventar estado de carga a mano con `useState`. Desde un event handler hay que envolver la llamada en `startTransition`.

5. **[2026-08-31] `global-error.tsx` debe declarar sus propios `<html>` y `<body>`.**
   Do instead: reemplaza al root layout cuando se activa, así que sin esas etiquetas la página queda rota. Los `error.tsx` anidados sí heredan el layout y burbujean al más cercano.

---

## Zod v4

1. **[2026-08-31] Los mensajes de error usan `{ error: "..." }`, no `{ message: "..." }`.**
   Do instead: `z.string().min(2, { error: "Muy corto." })`. La forma `message` es de Zod 3.

2. **[2026-08-31] `z.email()` es de primer nivel, no `z.string().email()`.**
   Do instead: `z.email({ error: "Correo inválido." })`.

3. **[2026-08-31] `z.coerce.number().optional()` devuelve `unknown` en el resolver de react-hook-form.**
   Do instead: `z.preprocess((v) => v === "" || v == null ? undefined : Number(v), z.number().optional())` para todo input numérico de HTML. (Trampa heredada del proyecto anterior, sigue vigente.)

---

## Supabase — RLS y Auth

1. **[2026-08-31] Nunca consultar `profiles` dentro de una política RLS de `profiles`.**
   Do instead: recursión infinita garantizada. El rol y el `organization_id` van en el JWT mediante un custom access token hook, y las políticas leen `auth.jwt()`. Las funciones auxiliares van en el esquema `private` como `SECURITY DEFINER STABLE`.

2. **[2026-08-31] Una tabla nueva sin política RLS es un bug bloqueante.**
   Do instead: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` en la misma migración que crea la tabla, siempre, incluso en tablas de configuración. Deny-by-default.

3. **[2026-08-31] El portal público NO escribe con el rol `anon`.**
   Do instead: las postulaciones entran por un Route Handler del servidor con service role, con validación Zod y rate limit. La `SUPABASE_SERVICE_ROLE_KEY` jamás lleva prefijo `NEXT_PUBLIC_` ni se importa en un client component.

4. **[2026-08-31] CVs en bucket privado con URL firmada, nunca pública.**
   Do instead: `createSignedUrl(path, 60)`. Una URL pública de Storage es permanente y adivinable.

---

## Tailwind v4

1. **[2026-08-31] La configuración vive en `src/app/globals.css` con `@theme inline`. NO existe `tailwind.config.ts`.**
   Do instead: tokens CSS en `:root {}` y `.dark {}`, mapeados en el bloque `@theme inline`. Nunca crear el archivo de config JS. (Trampa heredada, sigue vigente.)

---

## shadcn/ui v4

1. **[2026-08-31] `DropdownMenu`, `Select`, `Button`, `Dialog` usan `@base-ui/react` — NO aceptan `asChild`.**
   Do instead: pasar estilos por `className`. `Select.onValueChange` es `(v: string | null) => void` — usar `v ?? ""`.

2. **[2026-08-31] `Popover` usa `@radix-ui` y SÍ acepta `asChild`.**
   Do instead: no confundirlo con `DropdownMenu`. `<PopoverTrigger asChild>` funciona.

---

## Reglas del producto que se olvidan

1. **[2026-08-31] Todo botón de mutación usa `<ActionButton>`; toda eliminación usa `<DeleteButton>`.**
   Do instead: no escribir `<Button type="submit">` crudo para mutar. Eliminar siempre es rojo + ícono `X` + `<ConfirmDialog>`.

2. **[2026-08-31] Todo mensaje al usuario en español y concreto.**
   Do instead: `notifySuccess("Vacante publicada")`, nunca `"Éxito"`. Cero texto en inglés en la interfaz.

3. **[2026-08-31] El contenido lleva `pb-28` por el menú flotante inferior.**
   Do instead: sin ese padding la barra tapa el último elemento de toda lista.

4. **[2026-08-31] El color de acento es configurable por organización y alimenta `--ring` (el foco de teclado) — validar contraste, no solo formato hex.**
   Do instead: `src/lib/color-contrast.ts` calcula el contraste WCAG; `BrandingSchema` en `organizations/actions.ts` rechaza cualquier `accent_color` con menos de 3:1 contra el fondo `#faf9f7`, con un mensaje que explica por qué ("el foco de teclado no se vería"). Sin esto, un super admin podía elegir un acento claro y volver invisible el indicador de foco para cualquiera que navegue con teclado — viola "foco visible siempre".
