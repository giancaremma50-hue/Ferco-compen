# ATS — Plataforma de reclutamiento

Sistema de seguimiento de candidatos (Applicant Tracking System): publicar vacantes, recibir postulaciones, mover candidatos por un pipeline y decidir contrataciones con trazabilidad completa.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Supabase (Postgres + RLS, Auth Google, Storage, Realtime) · Resend · Vercel.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # y llenar los valores
npm run dev
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript sin emitir |
| `npm run email` | Vista previa de las plantillas de correo |

## Roles

| Rol | Alcance |
|---|---|
| `gestor` | Jefe de área: solicita plazas y opera el pipeline **de sus vacantes** |
| `admin` | RH: opera todo el reclutamiento y la configuración |
| `super_admin` | Control total + centro de errores + marca + bitácora |

El rol `colaborador` se eliminó: quien necesita ver una vacante se **suma como
miembro de esa vacante**, con uno de dos permisos.

| Permiso del miembro | Puede |
|---|---|
| `lectura_escritura` | Ve todo, escribe seguimientos, sube archivos, deja tareas y califica. **No** mueve etapas ni edita la vacante. |
| `solo_lectura` | Ve todo el registro —archivos, seguimientos, tareas—. No escribe nada. |

Mover etapas, contratar, descartar, agendar una reunión y escribirle al candidato
son decisiones del **reclutador asignado** de la vacante, `admin` o `super_admin`
— nadie más, por más permisos de miembro que tenga.

## Privacidad de candidatos

El candidato externo es el único usuario sin cuenta en la plataforma. Por eso:

- **`/privacidad`** es una página pública con la política versionada
  (`src/lib/legal/policy.ts`). Mientras le falten datos del cliente muestra un
  aviso de borrador y `robots: noindex`, que desaparece solo al completarlos.
- **Nadie postula sin aceptar**: casilla obligatoria validada con Zod en el
  servidor, y la prueba queda en `applications.privacy_consent_version` +
  `privacy_consent_at`.
- **El portal público no usa cookies.** Verificado: `Set-Cookie` = 0. Sin
  analítica, sin píxeles, sin recursos de terceros. Agregar cualquiera exige
  banner de consentimiento — ver `AGENTS.md`.
- **Los CV van a un bucket privado**, servidos con URL firmada de 60 s.

⚠️ El texto de la política es un borrador técnico. **Necesita revisión de un
abogado y 4 datos del cliente antes de publicarse** — ver `docs/PENDIENTE.md`,
punto 8.

## Seguridad

- **RLS activo en todas las tablas**, deny-by-default. Una tabla sin política es un bug bloqueante.
- Rol y organización viajan en el JWT; las políticas leen `auth.jwt()` y nunca consultan `profiles`.
- CVs en bucket privado con URL firmada de 60 s.
- HSTS y cabeceras de seguridad en `next.config.ts`.
- Content-Security-Policy con nonce por request (`src/proxy.ts`) — `script-src` estricto (sin `unsafe-inline`/`unsafe-eval` en producción).
- `SUPABASE_SERVICE_ROLE_KEY` y `RESEND_API_KEY` solo en el servidor.

## Estado del proyecto

| Fase | Estado |
|---|---|
| 0 — Fundamentos | ✅ |
| 1 — Diseño | ✅ |
| 2 — Base de datos y RLS | ✅ |
| 3 — Auth con Google y configurador | ✅ |
| 4 — Vacantes, portal público y postulación | ✅ |
| 5 — Pipeline kanban y perfil de candidato | ✅ |
| 6 — Notificaciones in-app y correo | ✅ |
| 7 — Centro de errores | ✅ |
| 8 — Bitácora de auditoría + colaboradores por vacante | ✅ |
| 9 — Configurador: departamentos, pipelines, motivos de rechazo | ✅ |
| 10 — Tareas del candidato | ✅ |
| 11 — Evaluación por competencias | ❌ eliminada (2026-09-03) |
| 12 — Plantillas de mensaje y correo directo al candidato | ✅ |
| 13 — Entrevistas y enlaces de Google Calendar | ✅ |
| 14 — Segmentos y filtros de candidatos | ✅ |
| 15 — Motor de plantillas de vacante | ✅ |
| 16 — Configurador de bolsa pública | ✅ |
| 17 — Fusión de plantilla de vacante + pipeline/competencias | ✅ |
| 18 — Wizard de plantillas de vacante, creación desde plantilla, portal público dinámico, bitácora en vacante, tooltips | ✅ |
| Mejoras post-Fase 7 (invitaciones, avatar, video de login, tutorial) | ✅ |
| Bolsa de empleo aspiracional (portada foto/video, cifras, filtros) | ✅ |
| 19 — Endurecimiento y despliegue | ✅ |
| Flujo de solicitud: plantilla general, estado `aceptada`, visibilidad de 3 niveles | ✅ |
| Inicio: agenda protagonista, buzón de solicitudes, embudo, informe por reclutador | ✅ |
| Permisos de 2 niveles por vacante + notificaciones en cada cambio de estado | ✅ |
| Consentimiento de privacidad en el portal público + política versionada | ⚠️ mecánica lista, texto pendiente de revisión legal |

Los dos pasos manuales que bloqueaban el login en el Dashboard de Supabase (activar el custom access token hook, configurar el proveedor de Google) **ya están hechos** — confirmado en el Dashboard el 2026-09-02.

**Dominio corporativo aún sin definir**: `organizations.allowed_email_domain` queda sin valor hasta que el usuario confirme el dominio real de la empresa — mientras tanto, cualquier cuenta de Google puede entrar. La restricción y su lista de excepciones (`profile_invites`) ya están construidas y activas en el código; falta solo escribir el dominio en esa columna (por ahora vía SQL/MCP de Supabase — todavía no hay un campo en `/configuracion` para editarlo) cuando el usuario lo tenga. Ver `docs/PENDIENTE.md` para esto y el resto de lo que falta.

## Para agentes de IA

Lee **`AGENTS.md`** antes de trabajar: contiene el uso obligatorio de skills, las reglas de interacción no negociables y las reglas de diseño visual.
Lee **`.claude/napkin.md`**: trampas conocidas, empezando por que en Next.js 16 el middleware ahora se llama `proxy.ts`.
Lee **`docs/PENDIENTE.md`**: qué falta de verdad ahora mismo, para no repetir trabajo ya hecho ni asumir que algo pendiente ya se resolvió.

### Herramientas requeridas

Las skills están versionadas en `.claude/skills/` y aplican solas. El único componente externo es el servidor MCP de memoria de código:

```bash
curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash
```

Instala el binario en `~/.local/bin`; `.mcp.json` ya lo tiene configurado. No requiere API keys ni servicios externos.
