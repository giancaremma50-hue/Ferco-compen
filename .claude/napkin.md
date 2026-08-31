# Napkin Runbook — ATS
_Última actualización: 2026-08-31_

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
