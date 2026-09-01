# Handoff — ATS Ferco

_Última actualización: 2026-09-01, cierre de Fase 7._

## Estado

Fases 0-7 completas, revisadas (`/code-review --high` a convergencia en cada una) y pusheadas a `claude/ats-platform-design-8ve51p` (commit `966c2b1`). `main` también está al día hasta el commit `b4e94b6` (Fase 6) — no se volvió a hacer fast-forward después de Fase 7, pendiente si el usuario lo pide.

| Fase | Estado |
|---|---|
| 0 — Limpieza y fundamentos | ✅ |
| 1 — Diseño (`/design`) | ✅ |
| 2 — Base de datos, RLS, seed | ✅ |
| 3 — Auth con Google, roles, configurador | ✅ |
| 4 — Vacantes, portal público, postulación | ✅ |
| 5 — Pipeline kanban, perfil de candidato | ✅ |
| 6 — Notificaciones in-app y correo | ✅ |
| 7 — Centro de errores | ✅ |
| 8 — Endurecimiento y despliegue en Vercel | **Pendiente — siguiente paso** |

Plan maestro original aprobado por el usuario: `/root/.claude/plans/quiero-que-usemos-este-ethereal-acorn.md` (en el entorno donde se creó; si no existe en la sesión nueva, el resumen de fases vive en `README.md` y cada plan de fase en `docs/superpowers/plans/`).

## Antes de tocar código

1. Leer `.claude/napkin.md` completo — bitácora curada con bugs reales y gotchas del stack, organizada por fase, máx. 10 ítems por categoría.
2. Leer `AGENTS.md` (raíz) — reglas del proyecto, no negociables de interacción/diseño, tabla de skills obligatorias.
3. Verificar RLS/schema real contra Supabase vía MCP antes de escribir queries nuevas — **nunca asumir**, ya causó bugs severos en fases anteriores (ver napkin).

## Pendiente — Fase 8 (Endurecimiento TLS y despliegue)

Del plan maestro original:
- Cabeceras de seguridad y HSTS en `next.config.ts`.
- Auditoría de rate limiting (ya existe en `/api/postular` y en `createErrorReport` — revisar si falta en algún otro endpoint público).
- `/security-review` completo.
- Auditoría completa de políticas RLS (recorrer las 18 tablas, confirmar deny-by-default sin excepción).
- Despliegue en Vercel con variables de entorno.

## Bloqueos que NO se pueden resolver por API/MCP

1. **Dos pasos manuales en el Dashboard de Supabase** (proyecto `cgudnnlcwcotovcslgzu`), sin los cuales el login no funciona en absoluto:
   - Authentication → Hooks → activar "Customize Access Token (JWT) Claims hook" → `public.custom_access_token_hook`.
   - Authentication → Providers → Google → Client ID/Secret con redirect URI `https://cgudnnlcwcotovcslgzu.supabase.co/auth/v1/callback`.
   - Al momento de este handoff, **no confirmado si el usuario ya los hizo** — preguntar antes de asumir que el login funciona.

2. **Despliegue a Vercel bloqueado por permisos**: `create_git_project` devolvió 403 (forbidden) al intentar crear el proyecto — la cuenta/token de Vercel conectado no tiene permiso, o la app de GitHub de Vercel no tiene acceso concedido al repo `Ferco-compen`. Tampoco hay ninguna herramienta MCP en esta sesión para configurar variables de entorno de Vercel. El usuario tendría que importar el repo manualmente desde el dashboard de Vercel (`vercel.com/new` → `giancaremma50-hue/Ferco-compen`, rama `main`) y cargar las variables — ver `.env.example` para la lista completa. `SUPABASE_SERVICE_ROLE_KEY` real ya está guardada en el `.env.local` de este entorno (no en git).

3. **`RESEND_API_KEY` y `ANTHROPIC_API_KEY` siguen vacías** — no bloquean nada (el envío de correo fue diseñado para fallar en silencio con `notifyBestEffort()`, ver napkin Fase 6), pero sin ellas no hay correos reales ni parseo de CV (que de todos modos no se llegó a construir — quedó fuera de alcance de Fase 4).

## Artefacto de demo

Se publicó un demo interactivo (mock, sin backend real) para que el cliente explore la interfaz: `https://claude.ai/code/artifact/619455d0-0537-41d3-9365-799cbe6b7595`. Fuente: `talento-ferco-demo.html` (vive en el scratchpad de la sesión que lo creó, no en el repo — si hace falta actualizarlo, re-publicar con el mismo `file_path` desde una sesión que lo tenga, o pedirle la URL al usuario y usar `action: "read"` para recuperar el HTML).

## Estructura relevante para retomar

```
.claude/napkin.md                          bitácora — leer primero
AGENTS.md                                  reglas del proyecto
docs/database.md                           schema + RLS documentados por fase
docs/superpowers/plans/                    un plan .md por fase (4 en adelante)
src/lib/errors/                            Centro de errores (Fase 7)
src/lib/notifications/                     Notificaciones (Fase 6)
src/lib/jobs/, src/lib/applications/       Vacantes y pipeline (Fases 4-5)
```

Proyecto Supabase: `cgudnnlcwcotovcslgzu` (nombre interno "V1-motoslam", reutilizado — ver napkin). Super admin: `giancaremma50@gmail.com`, se autoprovisiona en el primer login vía `handle_new_user()`, no requiere insert manual.
