<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# ATS — Reglas del proyecto

Plataforma de reclutamiento (Applicant Tracking System). Next.js 16 + Supabase + Vercel.
**Todo el producto está en español.** Cero texto en inglés en la interfaz.

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.3.x (App Router) — ver aviso de arriba |
| Lenguaje | TypeScript strict |
| Estilos | Tailwind v4 — tokens en `src/app/globals.css` con `@theme inline`. **Nunca crear `tailwind.config.ts`** |
| Componentes | shadcn/ui v4 (mezcla `@base-ui/react` y Radix) |
| Animación | framer-motion |
| Formularios | react-hook-form + Zod |
| Base de datos | Supabase Postgres con **RLS en todas las tablas** |
| Auth | Supabase Auth — Google OAuth, `@supabase/ssr`, cookies httpOnly |
| Archivos | Supabase Storage — bucket privado para CVs, público para marca |
| Correo | Resend + React Email (`emails/`) |
| Deploy | Vercel |

---

## Cierre de producción — regla obligatoria

**Toda fase o funcionalidad ya terminada y verificada se empuja directo al repositorio (push), sin esperar a agrupar varias fases.** Cada push de cierre incluye:

1. El código de la fase, ya pasado por `/code-review`.
2. Los documentos afectados actualizados en el mismo commit: `README.md` si cambió cómo se usa el proyecto, y este `AGENTS.md` si cambió una regla o el stack.
3. **`.claude/napkin.md` actualizado como bitácora de registro** — no solo trampas de sintaxis: toda decisión no obvia, todo error real encontrado y cómo se resolvió, y todo gotcha nuevo del stack. Es el historial de la construcción de la plataforma, se lee antes de tocar código y se cura en cada lectura (máx. 10 ítems por categoría, se re-prioriza).

No se deja trabajo terminado sin subir. "Terminado" significa: compila, pasa lint y typecheck, y pasó `/code-review`.

## Uso obligatorio de skills

Estas skills **no son opcionales**. Antes de empezar cualquier tarea, ubícala en esta tabla y carga la skill que corresponda.

| Cuando la tarea es… | Skill obligatoria |
|---|---|
| Diseñar pantallas o flujos nuevos | `/design` (canvas de artboards) + `ui-ux-pro-max` |
| Escribir o retocar cualquier componente de interfaz | `taste-skill` (`design-taste-frontend`) + `web-design-guidelines` |
| Escribir componentes o hooks de React | `react-best-practices` + `composition-patterns` |
| Planear una funcionalidad no trivial | `superpowers`: `brainstorming` → `writing-plans` → `executing-plans` |
| Depurar un fallo | `superpowers`: `systematic-debugging` — causa raíz, nunca parche |
| Antes de cerrar un cambio grande | `/ponytail-review` — detectar sobre-ingeniería |
| Recuperar contexto del código | `codebase-memory-mcp` |
| **Antes de TODO commit, sin excepción** | **`/code-review`** |
| Antes de cada despliegue | `/security-review` + auditoría de políticas RLS |
| Al descubrir una trampa recurrente | Anotarla en `.claude/napkin.md` |

Regla de cierre: **ningún commit entra sin haber pasado por `/code-review`.** Si el review encuentra algo, se corrige antes de commitear, no después.

---

## Reglas de interacción — no negociables

Están codificadas en componentes para que no dependan de la disciplina de nadie.

1. **Todo botón que muta datos usa `<ActionButton>`.**
   Estado `pending` con spinner, `disabled` mientras corre, `aria-busy`. El usuario nunca se queda sin saber si algo está pasando.
   Prohibido un `<Button type="submit">` crudo para una mutación.

2. **Toda acción exitosa confirma con un mensaje concreto.**
   `notifySuccess("Vacante publicada")`, nunca `"Éxito"` ni `"Listo"`. La mutación devuelve el texto; el toast (sonner) lo muestra.

3. **Todo botón de eliminar es rojo, con ícono `X` y confirmación.**
   Se usa `<DeleteButton>`, que abre `<ConfirmDialog>` nombrando el elemento a eliminar. Confirmar en rojo, cancelar neutro. **Nunca se elimina en un solo clic.**

4. **El menú principal es una barra flotante inferior.**
   Píldora fija en `bottom-6`, centrada, fondo sólido con borde de 1px. Acompaña la pantalla sin invadirla: se oculta al bajar, reaparece al subir, respeta `safe-area-inset-bottom`. Todo el contenido lleva `pb-28` para que nunca quede tapado. Máximo 5 ítems, según rol.

5. **Todo error se captura con un mensaje amigable y reportable.**
   Nada de stacks ni códigos crudos frente al usuario. Ver "Centro de errores" abajo.

6. Skeletons durante la carga. Estados vacíos con una acción, nunca un texto muerto. Foco visible siempre. `prefers-reduced-motion` respetado.

---

## Reglas de diseño visual — "editorial sobrio"

**Prohibido** (esto es lo que hace que una interfaz parezca generada por IA):
gradientes morados o multicolor · glassmorphism · sombras difusas de color · emojis usados como íconos · tarjetas flotando sobre tarjetas · ilustraciones 3D genéricas · `border-radius` grandes en todo · texto centrado por defecto.

**Sí:**
- Fondo blanco hueso `#FAF9F7`, superficies blancas. Nada de blanco puro de fondo.
- **La elevación se hace con un borde de 1px, no con sombra.**
- Un solo color de acento, usado con moderación. Es configurable por organización.
- Serif editorial en títulos de página y cifras destacadas; sans neutro en interfaz y datos.
- `font-variant-numeric: tabular-nums` en toda métrica y tabla.
- Escala de espaciado de 4px. Mucho aire. Densidad alta solo en tablas de candidatos.

---

## Seguridad — RLS y TLS

- **RLS activo en todas las tablas, deny-by-default.** Sin excepción, incluidas las de configuración. Una tabla nueva sin política es un bug bloqueante.
- **El rol y el `organization_id` viajan en el JWT** (custom access token hook). Las políticas leen `auth.jwt()`, **nunca consultan `profiles`** — eso causa recursión infinita.
- Toda tabla lleva `organization_id`, incluso operando un solo tenant.
- **`SUPABASE_SERVICE_ROLE_KEY` y `RESEND_API_KEY` jamás llevan prefijo `NEXT_PUBLIC_`** ni se importan en un client component.
- El portal público **no escribe con el rol `anon`**. Las postulaciones entran por un Route Handler del servidor con service role, con validación Zod y rate limit.
- CVs en bucket privado, servidos con URL firmada de 60 s. Nunca URL pública.
- Validación Zod en cada Server Action y Route Handler. El cliente nunca es fuente de verdad.
- HSTS y cabeceras de seguridad en `next.config.ts`.

---

## Centro de errores

El error no es un callejón sin salida: es el canal de soporte entre el usuario y el super admin.

- Los mensajes viven en `src/lib/errors/catalog.ts`. Redacción: **qué pasó en humano → qué no se perdió → qué puede hacer ahora.** Nunca culpar al usuario, nunca jerga, nunca un código sin explicación.
- Toda tarjeta de error ofrece **"Contarle al soporte"**. El diálogo hace una sola pregunta: *"¿Qué estabas intentando hacer?"*. El contexto técnico (URL, acción, stack, navegador, sesión) se adjunta solo.
- Se crea un `error_reports` con código `ERR-AAAA-NNNN` y se notifica al super admin.
- El super admin responde desde `/configuracion/errores`; el usuario ve y responde el hilo en "Mis reportes". Cada respuesta notifica a la otra parte.

---

## Roles

**Tres roles.** El rol `colaborador` se eliminó (2026-09-03) — su valor sigue en el enum `app_role` porque Postgres no permite borrarlo, pero no se asigna a nadie.

| Rol | Alcance |
|---|---|
| `gestor` | Jefe de área. Solicita plazas de su área y ve el pipeline **solo de sus vacantes**. |
| `admin` | RH. Opera todo el reclutamiento y la configuración de la organización. |
| `super_admin` | Control total + centro de errores + marca. |

Quien necesita ver una vacante se suma como **miembro de esa vacante**, con uno de **dos permisos, nunca más**:

| Permiso | Puede |
|---|---|
| `lectura_escritura` | Ve todo, escribe seguimientos, sube archivos, deja tareas y califica. **No** mueve etapas ni edita la vacante. |
| `solo_lectura` | Ve todo el registro (archivos, seguimientos, tareas). No escribe nada. |

**Las 5 decisiones de una vacante** —mover etapa, contratar, descartar, agendar reunión, escribirle al candidato— son del **reclutador asignado** (`jobs.owner_id`), `admin` o `super_admin`. Ningún permiso de miembro las habilita.

**Dos fuentes de permiso, nunca tres.** Decidir = `is_admin_or_above() OR jobs.owner_id = actor`. Escribir = eso, más `jobs.requested_by`, más miembro con `lectura_escritura`. El reclutador manda porque es `owner_id`, no por su fila en `job_collaborators`.

**Regla de permisos, no negociable:** las funciones `private.can_decide_application` / `can_write_application` de Postgres son el **espejo** de `src/lib/applications/permissions.ts`. Todo cambio de umbral se aplica en **ambos lados, en la misma sesión** — el SQL es la última línea, la que ve quien se salta la interfaz. Y se escriben como **lista blanca** (`WRITE_PERMISSIONS = new Set([...])`), nunca como "todo lo que no sea solo lectura": un valor nuevo del enum no nace con permiso por accidente.
