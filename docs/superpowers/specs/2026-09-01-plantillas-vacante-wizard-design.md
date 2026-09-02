# Rediseño: wizard de plantillas de vacante + creación de vacante

Fecha: 2026-09-01. Reemplaza el flujo actual de plantilla/vacante (Fase 15/17) por un
wizard de plantilla más rico y una creación de vacante 100% basada en plantilla.

## Alcance

**Sí incluye:** wizard de plantilla (6 pasos), creación de vacante basada en plantilla
obligatoria, candidatura dinámica por vacante en `/postular`, banco de preguntas con
precalificación por coincidencia exacta (determinística, sin IA), etapas de kanban por
plantilla, confidencialidad de plantilla, borrador/publicada, bitácora dentro de la
vacante, link público al guardar la vacante, restructuración de pestañas de
Configuración, tooltips del menú flotante.

**No incluye, explícitamente:** ningún Agente de Encaje/Match ni Agente de
precalificación por IA — la precalificación de este spec es comparación exacta de
opción elegida contra opción marcada como esperada, configurada a mano por quien arma
la plantilla. Tampoco incluye rediseño visual de la bolsa pública (Fase 16 queda como
está); el link generado apunta a la página pública existente, sin cambios de estilo.

## Pestañas de Configuración

- Fijas: Marca, Usuarios y roles, Departamentos, Centro de errores.
- Quedan, ya no fijas: Motivos de rechazo, Plantillas de mensaje (estándar por
  organización, sin cambio).
- Se elimina la pestaña Pipelines. El catálogo `pipeline_templates`/
  `pipeline_template_stages` se mantiene en base de datos (sigue siendo el punto de
  partida que el wizard ofrece en el paso Etapas) pero ya no tiene pantalla de
  administración propia — un set nuevo nace desde el wizard al marcar "Guardar como
  set reutilizable" con nombre.
- Se elimina la pestaña Bitácora. Su contenido se relocaliza dentro del detalle de
  cada vacante (ver más abajo).

## Modelo de datos

### `job_templates` — columnas nuevas

| Columna | Tipo | Notas |
|---|---|---|
| `status` | `text` check `('draft','published')` | default `'draft'`. Solo `published` aparece al crear una vacante. |
| `is_confidential` | `boolean` | default `false`. |
| `candidacy_fields` | `jsonb` | `{ full_name, email, phone, address, resume, cover_letter, additional_files }`, cada uno `'hidden'\|'optional'\|'required'`. `email` siempre `'required'`, la UI no permite cambiarlo. |
| `country` | ya existe | se mantiene como valor por defecto editable en la vacante. |

`created_by` no existe todavía en `job_templates` — se agrega
(`uuid references profiles`, `not null`, default `auth.uid()`), necesario para la
regla de confidencialidad. `is_public` (ya existe en `jobs`, no en `job_templates`)
se agrega también aquí — deja de ser editable al crear la vacante, la decide la
plantilla y se copia tal cual.

### Tablas nuevas — plantilla

- **`job_template_questions`**: `id`, `organization_id`, `job_template_id`, `prompt`,
  `type` check `('open','multiple_choice')`, `position`.
- **`job_template_question_options`**: `id`, `organization_id`, `question_id`,
  `label`, `is_expected boolean default false`, `position`. Solo aplica a preguntas
  `multiple_choice`.
- **`job_template_stages`**: `id`, `organization_id`, `job_template_id`, `title`,
  `position`, `kind` check `('bandeja_entrada','intermedia','contratado',
  'descartado')`. `bandeja_entrada` única y primera, `contratado`/`descartado` únicas
  y últimas — se fuerza en la Server Action, no con constraint SQL (la misma UX que
  ya usa `PipelineStagesEditor`).
- **`employment_reasons`**: `id`, `organization_id`, `label`. Catálogo con alta
  inline desde el selector de "Motivo de la vacante" al crear/editar una vacante.

RLS de las tres tablas hijas de plantilla: `SELECT` vía
`private.can_view_job_template(job_template_id)` (función nueva, security definer,
`organization_id = private.auth_org_id() AND (NOT is_confidential OR created_by =
(select auth.uid()) OR private.is_super_admin())`); `INSERT`/`UPDATE`/`DELETE`
`is_admin_or_above()` + organización, mismo patrón que `job_templates`.
`employment_reasons`: `SELECT`/`INSERT` para cualquier miembro de la organización
(quien crea una vacante puede agregar un motivo nuevo ahí mismo), `DELETE` solo
admin+.

### `job_templates_select` — política actualizada

Reemplaza el `USING` actual (`organization_id = private.auth_org_id()`) por
`private.can_view_job_template(id)` para que una plantilla confidencial no aparezca
en el bolsón de nadie salvo su creador y super_admin.

### `jobs` — columnas nuevas

`salary_min`, `salary_max`, `headcount`, `is_public` **ya existen** desde el
esquema fundacional (Fase 2) — no se tocan, `is_public` simplemente deja de
pedirse en el formulario de creación (se copia de la plantilla).

`jobs.employment_type` **ya existe** y ya significa otra cosa — tipo de
**contrato** (`indefinido`/`temporal`/`por_obra`/`pasantía`). El "Tipo de vacante"
del wizard (Nueva posición/Reemplazo/Crecimiento) es un concepto distinto y
necesita su propio nombre para no chocar:

| Columna | Notas |
|---|---|
| `vacancy_type` | check `('nueva_posicion','reemplazo','crecimiento')`, nullable. |
| `employment_reason_id` | FK a `employment_reasons`, nullable. |
| `job_template_id` | FK a `job_templates`, `on delete set null` — solo trazabilidad, no se vuelve a leer después de crear. |
| `candidacy_fields` | copia de la plantilla al momento de crear. |

### Tablas nuevas — vacante (copia de la plantilla al crear)

- **`job_questions`**, **`job_question_options`** — mismo shape que sus pares de
  plantilla, `job_id` en vez de `job_template_id`.
- `job_stages` ya existe (Fase 2/5) — sin cambio de forma. Cambia el origen: hoy
  `materializeJobStages` copia desde `pipeline_template_stages`; pasa a copiar desde
  `job_template_stages` de la plantilla elegida.
- **`application_answers`**: `id`, `organization_id`, `application_id`,
  `job_question_id`, `answer_text` (preguntas abiertas), `selected_option_id`
  (preguntas de opción múltiple). Sin política de `INSERT` para `anon` — se escribe
  únicamente desde el Route Handler de `/api/postular` con `createAdminClient()`,
  igual que `candidates`/`applications`/`attachments` hoy. `SELECT` igual que
  `applications` (`can_access_job`).
- `applications` gana `prequalified boolean null` — `null` si la vacante no tiene
  preguntas de opción múltiple, `true`/`false` si las tiene (coincide o no con las
  opciones `is_expected`).

**Copia, no referencia viva** (mismo patrón que `createJob` en Fase 17): el cliente
solo manda `template_id`; el servidor vuelve a leer título, descripción, requisitos,
`candidacy_fields`, preguntas y etapas desde `job_templates` con el cliente de
SESIÓN antes de copiarlos con el cliente admin (gestor no tiene RLS de escritura
sobre `job_questions`/`job_stages`, igual que hoy con `job_competencies`). Editar la
plantilla después de crear la vacante no mueve nada ya publicado.

### Bitácora dentro de la vacante

Nueva política de lectura sobre `audit_log`: se agrega `OR private.can_access_job
(entity_id)` cuando `entity_type = 'job'`, junto a la condición `super_admin` que ya
existe. La vacante muestra sus propios eventos (`entity_id = jobs.id`) a
`super_admin`, `admin`, y a cualquier `job_collaborator` de esa vacante — no a toda
la organización.

## Wizard de plantilla — 6 pasos

Pantalla completa, navegación **secuencial** (no salto libre). Cada "Siguiente"
guarda ese paso en base de datos (`UPDATE` sobre el `job_template` ya creado en modo
borrador desde el paso 1); "Atrás" no pierde nada porque ya quedó guardado.

1. **Detalles** — Título del anuncio, Descripción del puesto, Requisitos,
   Departamento, Puesto, Ubicación, País, Modalidad.
2. **Candidatura** — 7 campos, cada uno `No aparece` / `Opcional` / `Obligatorio`.
   Correo fijo en `Obligatorio`, sin switch.
3. **Preguntas** — banco de preguntas abiertas (sin match) o de opción múltiple
   (cada opción se marca "esperada" o no).
4. **Etapas** — Bandeja de entrada fija al inicio, Contratado/Descartado fijas al
   final, botón "Añadir etapa" en medio. Puede arrancar de un set guardado
   (`pipeline_templates`) y editarlo sin tocar el original; puede guardar el
   resultado como nuevo set reutilizable.
5. **Permisos y usos** — switch Confidencial (`is_confidential`).
6. **Cierre** — "Crear plantilla" (`status = 'published'`) / "Crear borrador"
   (se queda en `'draft'`).

## Creación de vacante

- Selector de plantilla **obligatorio** — solo `published`, y las `is_confidential`
  solo si el usuario es el creador o super_admin.
- Editable en este paso: País, Modalidad, Salario mínimo/máximo, Número de plazas,
  Tipo de vacante (Nueva posición/Reemplazo/Crecimiento), Motivo de la vacante
  (lista + alta inline sobre `employment_reasons`), Equipo de reclutamiento
  (Reclutador encargado → `job_collaborators` con `permission = 'owner'`;
  colaboradores adicionales → `permission = 'viewer'`, ajustable después desde el
  panel de colaboradores que ya existe).
- Todo lo demás se muestra de solo lectura (viene de la plantilla) y se copia tal
  cual al guardar.
- Al guardar, se muestra el link público de la vacante (el `slug` que ya existe
  desde Fase 4) con botón "Copiar" — para publicarlo en bolsas externas
  (LinkedIn, Computrabajo, etc.) con los métodos que la organización ya usa hoy.

## Portal público `/postular`

Hoy `ApplySchema` solo pide `full_name`, `email`, `phone`, `current_title`
(opcional), `years_experience` (opcional) y el archivo `cv` — no existen todavía
`Dirección`, `Carta de motivación` ni `Archivos adicionales`. Estos tres se agregan
como columnas/uso nuevo, no como algo que ya estaba oculto:

- `candidates.address` — `text` nullable (dato de identidad, igual que `phone`).
- `applications.cover_letter` — `text` nullable (contextual a esa postulación, no
  a la persona).
- "Archivos adicionales" no necesita columna nueva — `attachments.kind` ya es
  `text` libre (sin `CHECK`); se sube con `kind = 'adicional'`, uno o más por
  postulación.

`current_title`/`years_experience` quedan exactamente como están hoy — no forman
parte del tri-estado de Candidatura, el usuario no los mencionó al listar los 7
campos configurables.

Deja de tener un `ApplySchema` fijo. Por cada vacante:

- El formulario se arma según `jobs.candidacy_fields` — campos `hidden` no se
  muestran, `optional`/`required` controlan si el `Zod` los exige.
- Se muestran las preguntas de `job_questions`/`job_question_options` en el orden
  guardado; preguntas de opción múltiple son de selección única.
- Al guardar la postulación: las respuestas van a `application_answers`; si la
  vacante tiene alguna pregunta de opción múltiple, se calcula `prequalified`
  comparando cada respuesta elegida contra `is_expected` — `true` solo si todas
  coinciden, `false` en cualquier otro caso. Preguntas abiertas no participan del
  cálculo.
- `prequalified` se muestra como una insignia en la tarjeta del candidato dentro del
  kanban y en su perfil — no dispara ninguna acción automática (nada de descarte
  silencioso ni movimiento de etapa; el reclutador decide).

## Menú flotante — tooltips

Cada botón inactivo del menú (hoy solo ícono, sin `aria-label` ni texto visible)
gana `title` + un tooltip propio on-hover: fondo `#1F1E1B`, texto `#FAF9F7`,
sin sombra difusa, aparece/desaparece con una transición corta que se anula bajo
`prefers-reduced-motion`. El ítem activo conserva su etiqueta visible como hoy.

## Migración de datos existentes

- `job_templates` existentes: `status = 'published'` (para no desaparecer del
  selector), `is_confidential = false`, `candidacy_fields` con los 7 campos en
  `'required'` (preserva el comportamiento actual de `/postular`, que hoy exige
  todos los campos).
- `job_template_stages` de cada plantilla existente: se materializan copiando su
  `pipeline_template_id` resuelto (o el pipeline por defecto de la organización) —
  mismo cálculo que ya hace `materializeJobStages` hoy, ejecutado una vez como
  backfill.
- `jobs` existentes: sin backfill. `job_template_id`, `salary_min/max`,
  `headcount`, `employment_type`, `employment_reason_id` quedan `null` — son
  datos que no existían antes de esta fase, ninguna vacante vieja los necesita
  retroactivamente.

## Riesgos / decisiones tomadas sin volver a preguntar

- `employment_reasons`: alta inline abierta a cualquier rol que pueda crear una
  vacante (gestor+), no solo admin — a diferencia de `rejection_reasons`, que sigue
  siendo admin-only. Es una lista operativa, no una política de rechazo.
- Confidencialidad de plantilla: `super_admin` conserva visibilidad total pese a
  "solo el creador la ve" (consistente con "control total" del rol en el README).
- `pipeline_templates`/`pipeline_template_stages` no se borran ni se les quita RLS —
  solo pierden su pantalla de administración dedicada.
