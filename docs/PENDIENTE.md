# Pendiente — ATS Ferco

_Última actualización: 2026-09-08, después de la auditoría legal (privacidad, copyright, cookies) y de arreglar el portal público de postulaciones._

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

### 5. ~~Sacar el rol `colaborador`~~ — Resuelto 2026-09-03

La causa no era `invite-form.tsx` (como decía este documento tres versiones
seguidas) sino los defaults de la base: `profiles.role` y
`profile_invites.role` con DEFAULT `'colaborador'`, y `handle_new_user()`
cayendo a ese rol para todo login sin invitación — o sea, **todo usuario nuevo
nacía con un rol que ya no existía en el producto**. Los tres pasan a `gestor`
(migración `quitar_colaborador_de_los_defaults`).

De paso se cerraron dos huecos que una limpieza de interfaz sola habría dejado:
`updateUserRole` y `createInvite` validaban contra el enum COMPLETO de
Postgres, así que un POST fabricado a mano podía asignar el rol aunque el
desplegable ya no lo ofreciera. Ahora ambos usan `z.enum(ASSIGNABLE_ROLES)`, la
lista blanca de `src/lib/auth/role-labels.ts`.

Verificado en la base: 0 perfiles, 0 invitaciones pendientes, los 2 defaults en
`gestor`, 0 políticas RLS y 0 funciones que lo nombren. Detalle en
`docs/database.md` y `.claude/napkin.md`.

**Ojo con el efecto secundario:** el piso subió. Quien entra sin invitación
queda `gestor` (puede solicitar vacantes), no `colaborador` (solo veía vacantes
públicas y sus referidos). Con el punto 1 de este documento todavía abierto,
cualquier cuenta de Google recibe ese nivel — eso sube la prioridad del dominio
corporativo, no la baja.

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

### 8. Política de privacidad — falta el texto aprobado y 4 datos del cliente

La MECÁNICA completa ya está construida y verificada: página pública
`/privacidad`, casilla obligatoria validada con Zod en el servidor, prueba del
consentimiento en `applications.privacy_consent_version` + `privacy_consent_at`,
pie legal en los 3 correos que llegan al candidato, enlace en el pie del portal,
y declaración de autorización en el referido interno.

Lo que falta **no es código**. La página muestra un aviso de "borrador, no
publicado" y `robots: noindex` mientras `src/lib/legal/policy.ts` tenga
marcadores `[PENDIENTE: ...]`. El aviso desaparece solo al llenarlos.

**Cuatro datos que tiene que entregar el cliente:**
1. **Razón social exacta, NIT y domicilio fiscal** del responsable del
   tratamiento. Y si es una entidad para los 4 países o una por país — eso
   cambia el documento.
2. **Correo de contacto para ejercer derechos.** Un candidato externo no tiene
   cuenta; el centro de errores no le sirve. Tiene que ser un buzón atendido:
   el pie de los correos ya no promete "responde a este correo" justamente
   porque ese canal no existe.
3. **Plazo de conservación** de una candidatura no contratada. Sugerencia: 12
   meses desde la última actividad. Sin plazo no se puede escribir la sección 6.
4. **Confirmación de los encargados declarados** (Supabase, Resend, Vercel,
   Google — todos en EE. UU., ya listados en `ENCARGADOS`).

**Y revisión de un abogado antes de publicar.** El texto cubre el denominador
común más estricto de los 4 países, pero los marcos difieren: Nicaragua tiene
Ley 787 de Protección de Datos Personales (2012), la más concreta; Guatemala y
Honduras no tienen ley integral del sector privado; **de El Salvador no se pudo
confirmar el estado vigente** y no se inventó. Eso lo confirma un abogado, no
esta sesión.

**Consentimientos ya registrados bajo el borrador:** cualquier postulación que
entre antes de la aprobación queda con `privacy_consent_version = "0.1-borrador"`.
Al publicar la 1.0 hay que decidir si esas candidaturas necesitan
reconsentimiento — el índice parcial de la migración existe para poder
encontrarlas.

### 9. Retención automática de datos de candidatos

No existe ningún mecanismo de borrado ni expiración. Depende del plazo del punto
8. Una vez definido: un job que elimine candidaturas y sus archivos de Storage
pasado el plazo desde la última actividad. Sin esto, la sección 6 de la política
promete algo que el sistema no cumple.

### 10. Rate limit del endpoint público, a almacenamiento compartido

`src/lib/rate-limit.ts` es un `Map` en memoria del proceso (5/min). Se justificaba
con "no hay tráfico real todavía" — premisa que era cierta solo porque
`/api/postular` estaba inalcanzable por un bug, ya corregido. Ahora el endpoint
recibe de verdad y es el único camino por el que entrada anónima escribe en
Storage con service role (PDFs de hasta 10 MB). En Vercel el contador se reinicia
por instancia y no se comparte entre regiones. Siguiente paso cuando haya
volumen: tabla en Postgres o Upstash Redis.

### 11. Decisión pendiente del usuario: el bucket `archivos`

Se puso privado (era público, sin límite de tamaño ni allowlist de MIME) y se le
fijó un tope de 10 MB. **No se borró nada.** Contiene 1 objeto,
`Presentacipon_RH.html` — "Resumen Mensual Mayo 2026 - RH", resto del sistema
anterior de este proyecto de Supabase reutilizado. Ningún código del ATS
referencia ese bucket. Falta que el usuario diga si el archivo sirve; si no,
borrar objeto y bucket.

### 12. Verificar el logo de Google contra sus guidelines

`src/app/login/page.tsx:9` dibuja el "G" oficial en SVG inline. Es **marca
registrada, no copyright**, y usar el logo oficial es lo correcto para "Iniciar
sesión con Google" — pero tiene reglas propias (tamaño mínimo, espacio libre, no
alterar colores, texto aprobado del botón). El uso actual (18×18, colores
oficiales, "Continuar con Google") se ve conforme. Falta contrastarlo contra las
Google Sign-In Branding Guidelines vigentes. Riesgo bajo.

### 13. Nota de licencia en el configurador de marca

Los buckets de marca están vacíos hoy, así que el riesgo de copyright de
imágenes es futuro. Cuando el cliente suba logo, portada o video de login, ese
material entra sin control de procedencia. Falta una línea junto al campo de
subida: "Solo sube material propio o con licencia de uso comercial." Es lo único
que el software puede hacer al respecto.

### 14. Explícitamente fuera de alcance (no son pendientes)

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

### 15. V2 del plan maestro (no urgente, no empezado)

- Scorecards de entrevista estructurada con rúbrica fija.
- Dashboard de métricas (time-to-hire, conversión por etapa, fuente de contratación).
- Firma de ofertas.

## Cómo verificar que sigue al día

1. `select allowed_email_domain from organizations;` — si ya no es `null`, el punto 1 de arriba (dominio corporativo) está resuelto.
2. Punto 5 resuelto. Para confirmar que no volvió: `grep -rn "colaborador" src/`
   solo debe dar `ROLE_LABEL` (exhaustivo a propósito), `database.types.ts`
   (generado) y comentarios; ningún `z.enum` ni `Object.keys(ROLE_LABEL)`.
3. `select count(*) from profiles where department_id is not null;` — si es > 0,
   el punto 6 se puede desbloquear.
4. `curl -s -o /dev/null -D - <sitio>/empleos | grep -ic set-cookie` — si deja
   de ser 0, alguien agregó analítica o un tercero y hace falta banner de
   consentimiento (ver la regla de cookies en `AGENTS.md`).
5. Abrir `/privacidad`: si NO muestra el aviso rojo de "borrador, no publicado",
   el punto 8 está resuelto.
6. `.claude/napkin.md` tiene el detalle técnico de cada hallazgo real detrás de estos pendientes.
