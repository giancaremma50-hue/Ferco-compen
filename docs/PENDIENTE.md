# Pendiente — ATS Ferco

_Última actualización: 2026-09-03, después de cerrar el flujo de solicitud de vacante, el rediseño de Inicio y los permisos de 2 niveles por vacante._

## Estado general

Todo lo del plan maestro original (Fases 0-7) y todo lo construido en paralelo por otra sesión (Fases 8-18: colaboradores por vacante, bitácora, tareas del candidato, competencias, plantillas de mensaje, entrevistas con Calendar, segmentos de candidatos, motor de plantillas de vacante) más el paquete de mejoras posterior (invitaciones por dominio, avatar dinámico, video de login, tour guiado, validación en rojo, país/área como listas desplegables) **ya está en `main` y desplegado en producción**. Ver `README.md` → "Estado del proyecto" para la tabla fase por fase.

Los dos pasos manuales de Supabase que bloqueaban el login (activar el custom access token hook, configurar el proveedor de Google) **ya están hechos** — confirmado en el Dashboard.

Después de Fase 19 se construyó, se verificó y está en `main`: el flujo de
solicitud de vacante rediseñado (plantilla de puesto general, estado `aceptada`,
visibilidad de 3 niveles, admin puede crear la solicitud), el Inicio real (agenda
protagonista, buzón de solicitudes, embudo, informe por reclutador), y los
permisos de 2 niveles por vacante con notificaciones en cada cambio de estado.
Competencias se eliminó del proyecto por decisión del usuario. Detalle en
`docs/database.md` (bloques del inicio) y `.claude/napkin.md`.

## Pendiente real

### 1. Dominio corporativo aún sin definir

`organizations.allowed_email_domain` sigue vacío. Mientras tanto, **cualquier cuenta de Google puede entrar** a la app — no solo las del dominio de la empresa. El mecanismo de restricción y su lista de excepciones (`profile_invites`, para invitar puntualmente a alguien fuera del dominio) ya están construidos y activos en `src/app/auth/callback/route.ts`; falta solo:
- Que el usuario confirme el dominio real de la empresa.
- Cargarlo en `organizations.allowed_email_domain` (hoy solo se puede por SQL/MCP de Supabase — no hay campo en `/configuracion` para editarlo).
- (Opcional, mejora futura) Agregar ese campo a `/configuracion/marca` o una sección nueva, para que el super admin lo edite sin depender de un agente.

### 2. ~~Fase 19 — Endurecimiento y despliegue~~ — Resuelto 2026-09-02

- **Content-Security-Policy**: hecho. Nonce por request vía `src/proxy.ts` (`script-src` estricto, sin `unsafe-inline`/`unsafe-eval` en producción). `style-src` se dejó con `unsafe-inline` a propósito — el acento configurable por organización se aplica hoy con `style={{...}}` inline en muchos puntos (valor dinámico en tiempo real, no se puede resolver con una clase Tailwind fija); nonce-ar cada uno habría sido una migración grande sin forma de verificarla en este entorno (sin navegador con credenciales reales). Detalle en `.claude/napkin.md`.
- **Auditoría completa de políticas RLS**: hecho. Las 17 tablas de Fases 8-18 (candidate_tasks, application_competency_scores, message_templates, interviews, candidate_segments, job_templates y sus 3 tablas satélite, employment_reasons, job_questions/options, application_answers, job_collaborators, audit_log, profile_invites) leídas y contrastadas contra la matriz de roles — todas correctas, deny-by-default, org-scoped. De paso se encontró y se cerró un gap real que quedaba abierto de Fase 7 (no era parte de Fases 8-18, pero es la misma clase de bug): `error_reports_select`/`update`/`delete` y `error_report_messages_select` solo miraban `is_super_admin()`, nunca `organization_id` — verificado el fix con simulación de rol (super_admin de otra organización ahora ve 0 filas).
- **`/security-review` completo**: hecho — sweep de todo `src/` (Zod en Server Actions/Route Handlers, uso de `createAdminClient()`, XSS, inyección SQL, open redirect, rate limiting, autorización en Server Actions). Sin hallazgos.
- Rate limiting y cabeceras básicas: ya estaban hechos.

### 3. Correo real y parseo de CV

- `RESEND_API_KEY` está vacío en este entorno de desarrollo — sin él, ningún correo sale de verdad (el diseño ya contempla esto: `notifyBestEffort()` falla en silencio, nunca rompe una mutación). **Falta confirmar si ya está cargado en las variables de entorno de Vercel** — no es algo que se pueda verificar por MCP.
- `ANTHROPIC_API_KEY` también vacío. El parseo de CV con IA nunca se construyó — quedó fuera de alcance desde la Fase 4 (el reclutador siempre revisa los datos a mano). Sigue siendo v2, no bloquea nada del uso actual.

### 4. ~~Limpieza menor: variables de entorno muertas~~ — Resuelto 2026-09-02

`.env.example` en realidad **nunca llegó al repo** — `.gitignore` tenía `.env*` sin excepción, así que cualquier intento de commitearlo se ignoraba en silencio. En un repo público, eso significa que nadie que clone el proyecto tiene plantilla de qué variables llenar (el `cp .env.example .env.local` del README fallaba). Se agregó `!.env.example` al `.gitignore` y se creó el archivo desde cero, solo con las 6 variables que el código de verdad lee (`process.env.*` grepeado en `src/`) — sin `ALLOWED_EMAIL_DOMAIN` ni `SUPER_ADMIN_EMAIL`, que nunca existieron como variables reales.

### 5. Terminar de sacar el rol `colaborador` de la interfaz

Los perfiles ya se migraron a `gestor` y el modelo de permisos nuevo no lo usa,
pero **el rol sigue siendo invitable**: `invite-form.tsx` lo ofrece (y por
defecto). Mientras eso siga así, no es un rol muerto — es un rol sin nadie
asignado, y toda la lógica que lo trata como especial sigue siendo necesaria
(las guardias de `createJob` y `/vacantes/nueva` se quitaron una vez asumiendo
lo contrario y fue un bug real, ver `.claude/napkin.md`).

Falta: quitarlo de `invite-form.tsx` y limpiar los puntos de la interfaz que
todavía preguntan "¿es colaborador?". Va como paso propio, no colgado de otra
tarea. El valor `colaborador` se queda en el enum `app_role` para siempre —
Postgres no permite borrar un valor de un enum.

### 6. Filtro de plantillas por área — bloqueado en datos del cliente

Un gestor debería ver solo las plantillas de puesto de SU área al solicitar una
vacante. `profiles.department_id` y `job_templates.department_id` existen pero
están sin poblar, así que el filtro no se puede construir ni probar.

Hace falta que el cliente entregue: el listado de áreas, la asignación de cada
persona a su área, la asignación de cada puesto a su área, y la respuesta a
**¿alguien pertenece a más de un área?** (eso decide si la relación es una
columna o una tabla puente).

### 7. Fecha exacta de contratación

`applications` no guarda cuándo pasó a `contratada` — ni columna ni evento en
`application_events`. "Días a contratación" y "contrataciones del mes" en el
Inicio usan `updated_at` como aproximación, documentado en el código como no
garantizado. El arreglo es una columna `hired_at` o loguear el evento en
`hireApplication`; no bloquea nada hoy.

### 8. Explícitamente fuera de alcance (no son pendientes)

- **Agente de match/precalificación con IA** — excluido de forma permanente por
  decisión del usuario. No volver a proponerlo.
- **OAuth real de Google Calendar** — se revisó a fondo si ya existía: no, nunca
  se construyó. Las entrevistas generan un enlace "agregar a calendario", no un
  evento real ni una sala de reunión. El usuario decidió dejarlo fuera.
- **Módulo de bajas/terminaciones** — planteado y descartado en la misma sesión.
- **Refresco visual del panel interno de administración** — pausado por el
  usuario ("pausemos"), no cancelado.
- **Assets de portada reales de la marca** — el demo usa imágenes genéricas a
  propósito hasta que el cliente entregue las suyas.

### 9. V2 del plan maestro (no urgente, no empezado)

- Scorecards de entrevista estructurada con rúbrica fija.
- Dashboard de métricas (time-to-hire, conversión por etapa, fuente de contratación).
- Firma de ofertas.

## Cómo verificar que sigue al día

1. `select allowed_email_domain from organizations;` — si ya no es `null`, el punto 1 de arriba (dominio corporativo) está resuelto.
2. `grep -rn "colaborador" src/components/configuracion/invite-form.tsx` — sin
   resultados significa que el punto 5 está resuelto.
3. `select count(*) from profiles where department_id is not null;` — si es > 0,
   el punto 6 se puede desbloquear.
4. `.claude/napkin.md` tiene el detalle técnico de cada hallazgo real detrás de estos pendientes.
