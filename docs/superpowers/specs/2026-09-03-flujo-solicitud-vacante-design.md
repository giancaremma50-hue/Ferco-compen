# Flujo de solicitud de vacante, roles y pantalla de inicio

_Decidido con el usuario el 2026-09-03. Reemplaza el flujo descrito en el manual de uso
(`AtrioManualdeuso.docx`, septiembre 2026), que quedó desactualizado en varios puntos._

## Por qué

El manual generado en otra sesión describe un flujo que no calza con el código
(dice que la vacante se escribe a mano cuando en realidad nace de una plantilla de
puesto), y el usuario quiere además tres cambios de fondo: eliminar el rol
`colaborador`, partir aprobar/publicar en dos pasos, y convertir la pantalla de
inicio en reportería + buzón de solicitudes.

## Criterio que ordena todo

**La plantilla de puesto es general; la solicitud de vacante la vuelve específica.**
Un campo va en la plantilla solo si NO cambia entre dos vacantes del mismo puesto.

| Vive en la plantilla | Vive en la solicitud |
|---|---|
| Puesto (nombre interno), título, área | País, ubicación, modalidad, tipo de contrato |
| Descripción, requisitos, competencias | Plazas, tipo de vacante, motivo |
| Preguntas de candidatura, pipeline/etapas | Salario mín/máx (opcional, interno) |
| Confidencialidad **del catálogo** (quién ve la plantilla) | **Visibilidad de la vacante** (3 niveles, abajo) |

Un mismo "Asesor" se abre en Guatemala y en Nicaragua desde UNA plantilla.

## Visibilidad de la vacante — 3 niveles

Un solo campo (selector de 3 opciones, no 3 booleanos: dos booleanos permiten
combinaciones contradictorias como "pública y confidencial a la vez").

| Nivel | Portal público | Empleados autenticados (refieren) | Equipo de la vacante |
|---|---|---|---|
| `publica` | Sí | Sí | Sí |
| `interna` | No | Sí | Sí |
| `confidencial` | No | No | Sí |

Reemplaza `jobs.is_public`. Migración: `true → publica`, `false → confidencial`
(conserva exactamente el comportamiento actual, nadie ve más de lo que ya veía).

El nivel `interna` **no existe hoy**: una vacante no pública es invisible para
cualquier empleado que no esté en su equipo, así que nadie puede referir. El manual
ya lo promete ("vacantes publicadas al público interno") — este nivel cumple esa promesa.

## Flujo

### Paso 1 — Solicitar

**Gestor** (que tras este cambio es todo empleado): elige plantilla **de su área**
→ llena lo específico → `pendiente_aprobacion`. Ya no elige reclutador encargado.

**Admin / super admin**: misma pantalla, y además asigna el **gestor solicitante**
(jefe del área de la plaza, queda `approver`), se autoasigna como encargado, y puede
agregar más admins (entran `approver`). Nace directo en `aceptada` — su creación ya
es la aprobación, no pasa por el buzón de nadie.

### Paso 2 — RH acepta

Buzón en Inicio + la notificación `vacante_pendiente_aprobacion` que ya existe.
Acciones: **Aceptar** (asigna encargado: él mismo por defecto, reasignable a otro
admin/super admin) o **Devolver al solicitante**. Estado → `aceptada`.

### Paso 3 — RH publica

No configura pipeline ni preguntas (vienen de la plantilla, `createJob` ya las copia).
Revisa lo complementario, elige la **visibilidad**, publica → `abierta` + link para copiar.

### Paso 4 — Pipeline

Sin cambios. Es lo construido el 2026-09-02 (kanban a pantalla completa, drawer de
candidato con Información/Seguimientos/Bitácora, reuniones multi-destinatario).

## Roles

| | Antes | Después |
|---|---|---|
| Roles | 4 | 3: gestor, admin, super_admin |
| Perfiles `colaborador` | — | Pasan a `gestor` |
| Niveles por vacante | Solo limitaban al rol `colaborador`; un gestor los ignoraba | Aplican a todos menos admin/super_admin |
| Solicitante de la vacante | Sin fila en `job_collaborators` | `approver` automático de su vacante |

Niveles: `viewer` ve · `interviewer` califica, notas y tareas · `approver`/`owner`
mueve etapas, rechaza y contrata.

**El cambio más delicado del paquete.** Hoy `canDecideApplication` devuelve `true`
para cualquier rol que no sea `colaborador`; al quitar ese rol, sin el rewire
cualquier gestor podría decidir en toda vacante que alcance a ver. Y con el rewire
mal hecho, un gestor puede quedar sin poder operar su propia vacante (hoy el
solicitante no queda en `job_collaborators`). Va en su propio paso, con revisión de
las vacantes existentes.

`colaborador` queda huérfano en el enum `app_role` (Postgres no permite borrar un
valor de enum) — fuera de la interfaz, sin perfiles apuntando a él. Reversible.

## Pantalla de inicio

Reemplaza el texto placeholder ("El tablero de vacantes y candidatos llega en la
siguiente fase"). Bloques, con alcance por rol (admin/super_admin: organización
completa; gestor: solo lo suyo):

1. **Buzón** — RH ve pendientes por resolver; el gestor ve el estado de sus solicitudes.
2. **Embudo + KPIs** — vacantes abiertas, candidatos activos, contrataciones del mes, días a contratación.
3. **Agenda del día** — entrevistas de hoy, tareas vencidas.
4. **Informe por encargado** (solo admin/super_admin) — vacantes por encargado y estado,
   tasa de conversión, tiempo a contratación, vacantes estancadas (14+ días sin movimiento).

## Base de datos

- `job_status` → + `aceptada`. Transiciones: `pendiente_aprobacion → aceptada | borrador | cancelada`, `aceptada → abierta | cancelada`.
- `jobs` → nueva columna de visibilidad (enum de 3 valores); `is_public` se deja de leer.
  Las columnas `country`/`location`/`work_mode`/`employment_type` ya existen y son nullable: sin cambios.
- `job_templates` → `country`, `location`, `work_mode`, `employment_type` pasan a nullable y
  se dejan de leer/escribir (nullable en vez de borradas: reversible y barato, mismo criterio
  que `interviews.interviewer_id`). `is_confidential` se queda: es del catálogo, no de la vacante.
- `profiles.department_id` → se puebla con los datos que mande el cliente.
- RLS: `jobs_select_public` pasa a leer visibilidad, más una cláusula nueva para empleados
  autenticados en `publica`/`interna`. **Cambio de seguridad: se verifica con simulación real
  (JWT fabricado por rol) antes de darlo por bueno**, igual que la política de departamentos.
- Una política se reescribe: `employment_reasons_insert`, la única que nombra al rol `colaborador`.
- **Sin tablas nuevas.**

## Bug real que este trabajo arregla

`job_templates.is_public` arranca en `false` y **el wizard nunca lo pregunta ni lo
escribe**; `createJob` lo copia tal cual. Resultado: toda vacante creada desde
plantilla nace invisible en la bolsa de empleo, sin forma de cambiarlo desde la
interfaz. No se ha notado porque en producción hay 0 plantillas creadas y las
vacantes públicas que existen son del formulario libre anterior.

## Datos que hay que pedirle al cliente

Para el filtro de plantillas por área. No hace falta el organigrama completo:

1. **Áreas**: nombre exacto · país · correo del jefe del área → `departments`
2. **Personas con acceso**: nombre · correo corporativo (es la llave de Google) · área
   (debe calzar con la lista 1) · rol en Atrio · activo sí/no → `profiles`
3. **Puestos**: nombre del puesto · área → `job_templates.department_id`

Preguntar además: **¿hay gente que pertenece a más de un área?** Hoy una persona tiene
una sola (`profiles.department_id`); si hay casos reales hace falta una tabla persona↔áreas.

No hace falta pedir líneas de reporte persona→jefe directo; solo se necesitarían para la
regla más estricta ("solo puedo pedir plazas de los puestos que me reportan").

## Reglas de borde decididas

1. **Sin área asignada → no puede solicitar**, con mensaje que dice qué pedirle a RH.
   Hoy `profiles.department_id` es opcional y está vacío en varios perfiles.
2. **Plantilla sin área → solo la ve admin**, hasta que alguien le asigne área.
3. **Cualquier persona de un área puede solicitar plazas de esa área** (decisión del
   usuario). Incluye a un analista pidiendo una plaza de gerente de su propia área. Si
   más adelante se quiere más estricto, se combina con "y además es jefe del área" sin
   tocar datos.

## Orden de construcción

1. Plantilla general + solicitud específica + visibilidad de 3 niveles (arregla el bug de la bolsa)
2. Estado `aceptada` + aceptar / devolver / publicar
3. Variante de solicitud para admin (asigna gestor, se autoasigna, agrega admins)
4. Eliminar `colaborador`: rewire de permisos + migración de perfiles + limpieza de gates ← va solo
5. Filtro de plantillas por área + reglas de borde
6. Inicio: buzón + embudo + agenda
7. Inicio: informe por encargado
8. Actualizar el manual de uso (4 roles → 3, flujo nuevo, plantillas de puesto)

Cada paso: `/code-review`, typecheck, lint, build, y push a la rama y a `main`.

## Fuera de alcance, explícitamente

- Agente de encaje / precalificación de candidatos con IA — excluido de forma permanente.
- Integración real con la API de Google Calendar (OAuth por organización, sala de Meet
  automática). Se mantiene el enlace "agregar a Google Calendar" sin OAuth que ya existe.
- Punto 4 de la lista original del usuario: quedó truncado en el mensaje y se descartó.
