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
| 9+ | Pendientes |

**Antes de que el login funcione**, hay dos pasos manuales en el Dashboard de Supabase que ningún agente puede hacer por API — ver `.claude/napkin.md` sección "Pasos manuales pendientes":
1. Activar el custom access token hook (Authentication → Hooks).
2. Configurar el proveedor de Google (Authentication → Providers).

## Para agentes de IA

Lee **`AGENTS.md`** antes de trabajar: contiene el uso obligatorio de skills, las reglas de interacción no negociables y las reglas de diseño visual.
Lee **`.claude/napkin.md`**: trampas conocidas, empezando por que en Next.js 16 el middleware ahora se llama `proxy.ts`.

### Herramientas requeridas

Las skills están versionadas en `.claude/skills/` y aplican solas. El único componente externo es el servidor MCP de memoria de código:

```bash
curl -fsSL https://raw.githubusercontent.com/DeusData/codebase-memory-mcp/main/install.sh | bash
```

Instala el binario en `~/.local/bin`; `.mcp.json` ya lo tiene configurado. No requiere API keys ni servicios externos.
