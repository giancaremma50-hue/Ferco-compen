# Napkin Runbook — ATS
_Última actualización: 2026-08-31 (Fase 5)_

## Reglas de Curación
- Re-priorizar en cada lectura. Máximo 10 ítems por categoría.
- Es bitácora de registro: no solo trampas de sintaxis, también decisiones no obvias y errores reales con su corrección. Incluir fecha + "Do instead".
- **Leer ANTES de tocar código.**

---

## Límite del entorno de desarrollo remoto (no es un bug)

1. **[2026-08-31] `npm run dev` en este sandbox NO puede llamar a `*.supabase.co` directo — solo el MCP de Supabase tiene canal permitido.**
   Síntoma: cualquier página que dependa de datos de Supabase (branding, sesión) los recibe como `null` al probar con curl/Playwright contra el dev server local, aunque el código y la política RLS estén correctos (verificado por separado con SQL directo vía MCP). El error real es `"Host not in allowlist: <ref>.supabase.co"`.
   Do instead: verificar la lógica por inspección + typecheck/build + SQL directo contra la base (vía MCP), no por curl/Playwright al dev server para nada que dependa de red hacia Supabase. En producción (Vercel) esto no aplica — tiene salida a internet real. No perder tiempo intentando arreglarlo como si fuera un bug de la app.

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
