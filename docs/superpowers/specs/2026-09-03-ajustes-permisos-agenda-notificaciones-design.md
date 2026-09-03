# Ajustes: permisos de 2 niveles, agenda protagonista, notificaciones por estado

_Decidido con el usuario el 2026-09-03, después de un pase crítico sobre el flujo
construido el mismo día (ver `2026-09-03-flujo-solicitud-vacante-design.md`)._

## Decisiones cerradas

| # | Decisión |
|---|---|
| 1 | Inicio: **layout B** — agenda a ancho completo en primer lugar, cifras como tira de números en el encabezado, buzón en fila completa, informe al final. |
| 2 | `candidate_tasks` gana **fecha de vencimiento** (opcional). La agenda ordena por urgencia y marca lo vencido. |
| 3 | **El drawer es la interfaz principal del candidato.** `/postulaciones/[id]` queda como URL viva pero solo redirige al pipeline con el drawer abierto. |
| 4 | "Encargado" → **"Reclutador asignado"** en todo el copy. |
| 5 | Devolver una solicitud **exige motivo escrito**; el solicitante lo ve. |
| 6 | **Notificación en cada cambio de estado** de la vacante, a los involucrados. |
| 7 | Miembros de la vacante: **2 niveles** (lectura-escritura / solo lectura) + insignia del rol en ese registro. Todos removibles; quitar al reclutador asignado obliga a reasignar. |
| 8 | **Decidir = solo reclutador asignado, admin y super admin.** Cubre mover etapa, descartar, contratar, agendar reunión y mensaje al candidato. |
| 9 | **Calificar con estrellas = escritura** (lo puede hacer lectura-escritura). |
| 10 | **Competencias se eliminan del proyecto** (2 tablas + columna JSON + código + docs). |

## El cambio de fondo: de dónde sale el permiso

Antes: 3 fuentes solapadas — rol global, `job_collaborators.permission` (4 niveles
que **no hacían nada**, solo limitaban al rol `colaborador` ya extinto), y
`jobs.owner_id`/`requested_by`.

Después, 2 fuentes y sin ambigüedad:

- **Decidir** (mover etapa, descartar, contratar, agendar, mensajear) =
  `is_admin_or_above()` **o** `jobs.owner_id = yo`. Nada más.
- **Escribir** (seguimientos, archivos, tareas, calificación de estrellas) =
  quien puede decidir, **o** el solicitante, **o** un miembro con nivel
  `lectura_escritura`.
- **Ver** = lo que ya resuelve `can_access_job` (RLS), sin cambios.

Los 2 niveles describen únicamente a **la gente que se suma**. El poder del
reclutador asignado no sale de la tabla de miembros, sale de `jobs.owner_id` — la
fila en `job_collaborators` existe solo para que aparezca en la lista.

**Consecuencia explícita, aceptada por el usuario: el gestor que solicitó la
vacante ya NO mueve etapas ni decide.** Escribe seguimientos, sube archivos, deja
tareas y califica, pero no avanza candidatos. Esto cambia lo que decidimos horas
antes (lo había dejado como `approver`) y lo que el manual dice hoy — el manual se
actualiza en el mismo paquete.

## Insignias, no niveles extra

La lista de miembros muestra una sola tabla, cada fila con su insignia. La
insignia se **deriva**, no se guarda: se compara `profile_id` contra
`jobs.requested_by` y `jobs.owner_id`. Así no hay un cuarto valor de permiso que
mantener sincronizado con dos columnas de la vacante.

- **Solicitante** — quien pidió la vacante.
- **Reclutador asignado** — quitarlo abre la reasignación; la vacante nunca queda
  sin reclutador (si quedara, solo admins podrían operarla).
- **Lectura y escritura** / **Solo lectura** — el resto.

## Notificaciones por estado

Regla base: **nunca se notifica a quien ejecutó la acción.**

| Cambio | Destinatarios |
|---|---|
| Enviada a aprobación | Admins y super admins *(ya existía)* |
| Aceptada | Solicitante + reclutador asignado |
| Devuelta al solicitante | Solicitante, **con el motivo** |
| Publicada | Solicitante + reclutador asignado + miembros |
| Pausada / Reabierta | Solicitante + reclutador asignado + miembros |
| Cerrada | Solicitante + reclutador asignado + miembros |
| Cancelada | Solicitante + reclutador asignado + miembros |

Requiere un valor nuevo en `notification_type` (los 6 actuales no cubren esto).

## Motivo de devolución

Columna `jobs.return_reason` (texto, nullable). Se **limpia al reenviar a
aprobación** — si no, queda un motivo viejo pegado a una vacante ya corregida.
La *historia* de devoluciones ya está en la bitácora de la vacante (el trigger
`audit_job_status_change` registra cada `pendiente_aprobacion → borrador` con
fecha y autor); lo que la columna agrega es el texto del motivo vigente. Si algún
día se necesita el texto de cada devolución histórica, ahí sí entra una tabla
aparte.

## El drawer como principal

`/postulaciones/[id]` deja de dibujar pantalla y redirige a
`/vacantes/[jobId]/pipeline?candidato=[id]`. El drawer se abre **desde el
parámetro de la URL, sin depender de que la tarjeta esté en el tablero** — clave,
porque `getKanbanData` solo trae postulaciones activas: un correo viejo sobre un
candidato ya contratado o descartado seguiría abriendo bien, solo sin el botón
"Siguiente etapa" (no hay etapa actual en el tablero).

Se borran los 3 componentes que solo usaba esa página: `CvLink`, `InterviewForm`
(formulario plano de entrevista) y `CompetencyRow`. Los otros 10 sobreviven porque
el drawer ya los comparte.

Enlaces que siguen funcionando sin tocarse: las 3 notificaciones de candidato, la
tabla de Candidatos, los 2 enlaces de la agenda de Inicio y el correo de
`/api/postular`.

## Competencias: qué se borra

Verificado antes de decidir: **0 filas en todo**.

- `job_competencies` (rúbrica por vacante: nombre, peso, posición) — 0 filas.
- `application_competency_scores` (nota y comentario por evaluador por competencia) — 0 filas.
- `job_templates.competencies` (columna JSONB con la rúbrica de la plantilla) — 0 plantillas con contenido.

Código: `src/lib/competencies/*`, `competency-row.tsx`, `competencies-panel.tsx`,
`competency-list-editor.tsx`, el editor de rúbrica del paso 1 del wizard, la copia
en `createJob`, el bloque en el detalle de la vacante, `CompetencyDraftSchema`.

**Consecuencia nombrada:** al quitar la rúbrica, la única herramienta de evaluación
que queda es la calificación de estrellas (0-5, un número, sin criterios) más las
notas. Decisión de producto, no un descuido.

**Efecto secundario bueno:** `canRateApplication` existía *solo* para proteger las
estrellas (un único punto de uso) — se colapsa dentro del nivel de escritura y
desaparece.

## Tareas y reuniones: solo gente de la vacante

Hoy la lista de asignables trae **todos los admin de la organización** (sin
importar si tienen algo que ver con la vacante) más los colaboradores. Pasa a ser:
reclutador asignado + solicitante + miembros, todos activos.

La misma función alimenta los destinatarios de reuniones, así que también se
angosta ahí — a propósito: no debería poderse invitar a una entrevista a alguien
ajeno a la vacante. Costo aceptado: para asignarle algo a otro admin, primero hay
que sumarlo como miembro.

## Orden de construcción

1. **Migraciones** (2): valores nuevos de enum; luego columnas nuevas
   (`candidate_tasks.due_date`, `jobs.return_reason`), migración de las 9 filas de
   `job_collaborators` a los 2 niveles, y borrado de competencias.
2. **Eliminar competencias del código** — mecánico y grande, desbloquea el resto.
3. **Permisos**: rewire de quién decide/escribe, 2 niveles, panel de miembros con
   insignias y reasignación, borrar la frase "Acceso fino por persona…".
4. **Reclutador asignado** (rename) + motivo de devolución + notificaciones por estado.
5. **Inicio layout B** + fecha de vencimiento en tareas.
6. **Drawer principal** + `/postulaciones/[id]` a redirect + borrar 3 componentes.
7. **Documentación**: `docs/database.md`, napkin, y el manual de uso (3 roles,
   sin competencias, flujo y permisos nuevos).

Cada paso: `/code-review`, typecheck, lint, build, push a la rama y a `main`.

## Fuera de alcance

- Agente de encaje / precalificación con IA — excluido de forma permanente.
- Integración real con Google Calendar (OAuth, sala de Meet automática).
- Filtro de plantillas por área del solicitante — bloqueado en datos del cliente.
- Módulo de bajas/terminaciones — no existe; si se quiere, se diseña aparte.
