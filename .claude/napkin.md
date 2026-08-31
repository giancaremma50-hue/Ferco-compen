# Napkin Runbook — ATS
_Última actualización: 2026-08-31_

## Reglas de Curación
- Re-priorizar en cada lectura. Máximo 10 ítems por categoría.
- Es bitácora de registro: no solo trampas de sintaxis, también decisiones no obvias y errores reales con su corrección. Incluir fecha + "Do instead".
- **Leer ANTES de tocar código.**

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

---

## Next.js 16 — Cambios de ruptura (MÁXIMA PRIORIDAD)

1. **[2026-08-31] `middleware.ts` NO EXISTE. Ahora se llama `proxy.ts`.**
   Do instead: archivo `proxy.ts` en la raíz del proyecto o dentro de `src/`, al mismo nivel que `app/`. Exporta `export function proxy(request: NextRequest)` o un default export. `export const config = { matcher: [...] }` sigue igual. **Toda la documentación de `@supabase/ssr` en internet dice `middleware.ts` — está desactualizada para Next 16.** Verificado en `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.

2. **[2026-08-31] Proxy corre en runtime de Node.js, no en Edge.**
   Do instead: se puede usar el SDK completo de Supabase dentro de `proxy.ts` sin preocuparse por compatibilidad con Edge. Solo leer la sesión de la cookie — **nunca consultar la base** desde el proxy, porque corre en cada ruta incluidas las prefetch.

3. **[2026-08-31] El proxy es un chequeo optimista, NO la capa de seguridad.**
   Do instead: la autorización real vive lo más cerca posible del dato: políticas RLS en Postgres + un Data Access Layer con `verifySession()` memoizado con `cache()` de React y `import 'server-only'` al inicio del archivo. El proxy solo redirige rápido.

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
