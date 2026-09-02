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
| `colaborador` | Empleado: ve vacantes publicadas, refiere candidatos, sigue a sus referidos |
| `gestor` | Jefe de área: solicita plazas y opera el pipeline **de sus vacantes** |
| `admin` | RH: opera todo el reclutamiento y la configuración |
| `super_admin` | Control total + centro de errores + marca + bitácora |

El acceso fino se resuelve con permisos por vacante (`job_collaborators`), no subiendo el rol global.

## Seguridad

- **RLS activo en todas las tablas**, deny-by-default. Una tabla sin política es un bug bloqueante.
- Rol y organización viajan en el JWT; las políticas leen `auth.jwt()` y nunca consultan `profiles`.
- CVs en bucket privado con URL firmada de 60 s.
- HSTS y cabeceras de seguridad en `next.config.ts`.
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
| 11 — Evaluación por competencias | ✅ |
| 12 — Plantillas de mensaje y correo directo al candidato | ✅ |
| 13 — Entrevistas y enlaces de Google Calendar | ✅ |
| 14 — Segmentos y filtros de candidatos | ✅ |
| 15 — Motor de plantillas de vacante | ✅ |
| 16 — Configurador de bolsa pública | ✅ |
| 17 — Fusión de plantilla de vacante + pipeline/competencias | ✅ |
| 18 — Wizard de plantillas de vacante, creación desde plantilla, portal público dinámico, bitácora en vacante, tooltips | ✅ |
| Mejoras post-Fase 7 (invitaciones, avatar, video de login, tutorial) | ✅ |
| 19 — Endurecimiento y despliegue | Pendiente |

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
