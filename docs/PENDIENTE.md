# Pendiente — ATS Ferco

_Última actualización: 2026-09-02, después de fusionar la línea de Fases 8-18 con Fase 7 y el paquete de mejoras post-Fase 7, y del primer despliegue exitoso en Vercel._

## Estado general

Todo lo del plan maestro original (Fases 0-7) y todo lo construido en paralelo por otra sesión (Fases 8-18: colaboradores por vacante, bitácora, tareas del candidato, competencias, plantillas de mensaje, entrevistas con Calendar, segmentos de candidatos, motor de plantillas de vacante) más el paquete de mejoras posterior (invitaciones por dominio, avatar dinámico, video de login, tour guiado, validación en rojo, país/área como listas desplegables) **ya está en `main` y desplegado en producción**. Ver `README.md` → "Estado del proyecto" para la tabla fase por fase.

Los dos pasos manuales de Supabase que bloqueaban el login (activar el custom access token hook, configurar el proveedor de Google) **ya están hechos** — confirmado en el Dashboard.

## Pendiente real

### 1. Dominio corporativo aún sin definir

`organizations.allowed_email_domain` sigue vacío. Mientras tanto, **cualquier cuenta de Google puede entrar** a la app — no solo las del dominio de la empresa. El mecanismo de restricción y su lista de excepciones (`profile_invites`, para invitar puntualmente a alguien fuera del dominio) ya están construidos y activos en `src/app/auth/callback/route.ts`; falta solo:
- Que el usuario confirme el dominio real de la empresa.
- Cargarlo en `organizations.allowed_email_domain` (hoy solo se puede por SQL/MCP de Supabase — no hay campo en `/configuracion` para editarlo).
- (Opcional, mejora futura) Agregar ese campo a `/configuracion/marca` o una sección nueva, para que el super admin lo edite sin depender de un agente.

### 2. Fase 19 — Endurecimiento y despliegue

Del plan maestro original, lo que falta:
- **Content-Security-Policy** — es la única cabecera de seguridad que falta (HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy ya están en `next.config.ts`). Requiere nonce por request vía `src/proxy.ts` dado que todas las rutas ya son dinámicas — diseño ya discutido, no implementado todavía.
- **Auditoría completa de políticas RLS** — recorrer las tablas nuevas de las Fases 8-18 (candidate_tasks, competency_evaluation, message_templates, interviews, candidate_segments, job_templates y sus tablas satélite) contra la matriz de roles del proyecto y `get_advisors` de Supabase; las de Fases 0-7 ya se verificaron varias veces durante su construcción.
- **`/security-review` completo** — pasada de cierre sobre todo el código, no solo RLS (manejo de secretos, validación, Server Actions).
- Rate limiting y cabeceras básicas: **ya hechos** (no era necesario repetirlos).

### 3. Correo real y parseo de CV

- `RESEND_API_KEY` está vacío en este entorno de desarrollo — sin él, ningún correo sale de verdad (el diseño ya contempla esto: `notifyBestEffort()` falla en silencio, nunca rompe una mutación). **Falta confirmar si ya está cargado en las variables de entorno de Vercel** — no es algo que se pueda verificar por MCP.
- `ANTHROPIC_API_KEY` también vacío. El parseo de CV con IA nunca se construyó — quedó fuera de alcance desde la Fase 4 (el reclutador siempre revisa los datos a mano). Sigue siendo v2, no bloquea nada del uso actual.

### 4. ~~Limpieza menor: variables de entorno muertas~~ — Resuelto 2026-09-02

`.env.example` en realidad **nunca llegó al repo** — `.gitignore` tenía `.env*` sin excepción, así que cualquier intento de commitearlo se ignoraba en silencio. En un repo público, eso significa que nadie que clone el proyecto tiene plantilla de qué variables llenar (el `cp .env.example .env.local` del README fallaba). Se agregó `!.env.example` al `.gitignore` y se creó el archivo desde cero, solo con las 6 variables que el código de verdad lee (`process.env.*` grepeado en `src/`) — sin `ALLOWED_EMAIL_DOMAIN` ni `SUPER_ADMIN_EMAIL`, que nunca existieron como variables reales.

### 5. V2 del plan maestro (no urgente, no empezado)

- Scorecards de entrevista estructurada con rúbrica fija.
- Dashboard de métricas (time-to-hire, conversión por etapa, fuente de contratación).
- Firma de ofertas.

## Cómo verificar que sigue al día

1. `README.md` → "Estado del proyecto" debe decir "Fase 19 — Endurecimiento y despliegue: Pendiente" — si ya dice "✅", este archivo está desactualizado.
2. `select allowed_email_domain from organizations;` — si ya no es `null`, el punto 1 de arriba está resuelto.
3. `.claude/napkin.md` tiene el detalle técnico de cada hallazgo real detrás de estos pendientes.
