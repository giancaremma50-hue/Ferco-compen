# Fase 18 (1/7): Esquema y RLS — wizard de plantillas de vacante

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** agregar, sin romper nada existente, todo el esquema y las políticas RLS
que necesita el wizard de plantillas de vacante (spec:
`docs/superpowers/specs/2026-09-01-plantillas-vacante-wizard-design.md`) — sin
tocar ninguna pantalla todavía. Es la fase 1 de 7; las fases 2-7 (config tabs,
wizard, creación de vacante, portal público, bitácora en vacante, tooltips) se
planean por separado, cada una justo antes de ejecutarse.

**Architecture:** todo el esquema vive como migraciones aplicadas vía el MCP de
Supabase (`apply_migration`, proyecto `cgudnnlcwcotovcslgzu`), no como archivos
`.sql` en el repo — mismo mecanismo que toda la base de datos actual (ver
`docs/database.md`, "Cómo se generó"). Cada tarea es una migración independiente;
la última tarea regenera `database.types.ts`, documenta en `docs/database.md` y
hace el único commit de esta fase.

**Tech Stack:** Supabase Postgres + RLS, MCP de Supabase (`apply_migration`,
`execute_sql`, `get_advisors`, `generate_typescript_types`).

**Por qué es segura de subir sola:** todas las columnas nuevas son nullable o
tienen default; ninguna tabla ni columna existente se borra o renombra; ningún
código de la app cambia en esta fase, así que nada de lo que ya funciona hoy deja
de compilar o de pasar RLS.

---

### Task 1: `job_templates` — columnas nuevas + confidencialidad

**Herramienta:** MCP de Supabase, `apply_migration`, `project_id:
"cgudnnlcwcotovcslgzu"`.

- [x] **Step 1: Aplicar la migración**

```sql
alter table public.job_templates
  add column created_by uuid references public.profiles(id),
  add column is_public boolean not null default false,
  add column status text not null default 'draft' check (status in ('draft','published')),
  add column is_confidential boolean not null default false,
  add column candidacy_fields jsonb not null default '{
    "full_name": "required",
    "email": "required",
    "phone": "required",
    "address": "required",
    "resume": "required",
    "cover_letter": "required",
    "additional_files": "required"
  }'::jsonb;

-- Backfill: las plantillas que ya existan quedan asignadas al super_admin
-- activo de su organización (siempre hay exactamente uno o más, ver
-- private.guard_last_super_admin en napkin.md) y publicadas, para no
-- desaparecer del selector de vacante nueva cuando ese selector se vuelva
-- obligatorio en la Fase 18 (4/7).
update public.job_templates jt
set created_by = (
  select p.id from public.profiles p
  where p.organization_id = jt.organization_id
    and p.role = 'super_admin'
    and p.is_active
  order by p.created_at asc
  limit 1
)
where jt.created_by is null;

update public.job_templates set status = 'published' where status = 'draft';

alter table public.job_templates alter column created_by set not null;

create or replace function private.can_view_job_template(template_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.job_templates jt
    where jt.id = template_id
      and jt.organization_id = private.auth_org_id()
      and (
        not jt.is_confidential
        or jt.created_by = (select auth.uid())
        or private.is_super_admin()
      )
  );
$$;

drop policy if exists job_templates_select on public.job_templates;
create policy job_templates_select on public.job_templates
  for select
  to authenticated
  using (private.can_view_job_template(id));

-- job_templates_write_admin (Fase 15) es FOR ALL, y en Postgres eso también
-- cubre SELECT — se combina en OR con la política de arriba y deja ver una
-- plantilla confidencial a cualquier admin+ igual, sin pasar por
-- can_view_job_template. Se reemplaza por tres políticas separadas, ninguna
-- cubre SELECT (bug real encontrado con la simulación de rol del Step 3, ver
-- la sección "Ejecutado" al final de este documento y docs/database.md).
drop policy if exists job_templates_write_admin on public.job_templates;

create policy job_templates_insert_admin on public.job_templates
  for insert to authenticated
  with check (organization_id = private.auth_org_id() and private.is_admin_or_above());

create policy job_templates_update_admin on public.job_templates
  for update to authenticated
  using (organization_id = private.auth_org_id() and private.is_admin_or_above())
  with check (organization_id = private.auth_org_id() and private.is_admin_or_above());

create policy job_templates_delete_admin on public.job_templates
  for delete to authenticated
  using (organization_id = private.auth_org_id() and private.is_admin_or_above());
```

Nombre de la migración: `job_templates_confidentiality_and_status` — el bloque
`job_templates_write_admin`/`insert_admin`/`update_admin`/`delete_admin` de
arriba se aplicó como una segunda migración de seguimiento en la misma
sesión, `fix_job_templates_write_admin_for_all_select_leak`, después de que el
Step 3 de abajo mostrara la plantilla confidencial visible para un admin
cualquiera. Se deja fusionado en un solo bloque acá porque es la forma
correcta de correr esta tarea desde cero — no tiene sentido reproducir a
propósito el paso intermedio con el bug.

- [x] **Step 2: Verificar con `execute_sql`**

```sql
select column_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'job_templates'
  and column_name in ('created_by','is_public','status','is_confidential','candidacy_fields')
order by column_name;
```

Esperado: 5 filas, `created_by` con `is_nullable = 'NO'` y sin `column_default`
(la volatilidad de `auth.uid()` en un `default` de columna no sirve — por eso el
backfill de arriba corre antes de fijar `not null`), el resto con su default.

- [x] **Step 3: Simular RLS con un JWT de prueba**

```sql
begin;
select set_config('request.jwt.claims', json_build_object(
  'sub', (select id from public.profiles where role = 'admin' limit 1),
  'app_metadata', json_build_object(
    'role', 'admin',
    'organization_id', (select organization_id from public.profiles where role = 'admin' limit 1)
  )
)::text, true);
set role authenticated;
-- Una plantilla confidencial de OTRO creador no debe aparecer:
insert into public.job_templates (organization_id, name, title, country, location, work_mode, employment_type, description, requirements, created_by, is_confidential)
values ((select organization_id from public.profiles where role = 'admin' limit 1), 'Prueba confidencial', 'x', 'GT', 'x', 'remoto', 'indefinido', 'x', 'x', (select id from public.profiles where role = 'super_admin' limit 1), true);
select count(*) from public.job_templates where name = 'Prueba confidencial'; -- esperado: 0 filas visibles
reset role;
rollback;
```

Expected: el segundo `select count(*)` devuelve `0` — el `admin` de prueba no ve
la plantilla confidencial de otro creador. `rollback` deshace todo, nada queda
escrito.

- [x] **Step 4: Commit** — no aplica todavía (sin cambios de archivos en el
  repo); se documenta y commitea junto con el resto en el Task 10.

---

### Task 2: `job_template_questions` + `job_template_question_options`

- [x] **Step 1: Aplicar la migración** (`job_template_questions_and_options`)

```sql
create table public.job_template_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  job_template_id uuid not null references public.job_templates(id) on delete cascade,
  prompt text not null,
  type text not null check (type in ('open','multiple_choice')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index job_template_questions_template_idx on public.job_template_questions(job_template_id);
alter table public.job_template_questions enable row level security;

create policy job_template_questions_select on public.job_template_questions
  for select to authenticated
  using (private.can_view_job_template(job_template_id));

-- FOR INSERT/UPDATE/DELETE por separado, nunca FOR ALL: mismo bug que
-- job_templates_write_admin (Task 1) — FOR ALL también cubre SELECT.
create policy job_template_questions_insert_admin on public.job_template_questions
  for insert to authenticated
  with check (organization_id = private.auth_org_id() and private.is_admin_or_above());

create policy job_template_questions_update_admin on public.job_template_questions
  for update to authenticated
  using (organization_id = private.auth_org_id() and private.is_admin_or_above())
  with check (organization_id = private.auth_org_id() and private.is_admin_or_above());

create policy job_template_questions_delete_admin on public.job_template_questions
  for delete to authenticated
  using (organization_id = private.auth_org_id() and private.is_admin_or_above());

create table public.job_template_question_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  -- Denormalizado a propósito: job_template_id se repite acá (no solo vía
  -- question_id) para que esta tabla tenga la MISMA política de lectura que
  -- job_template_questions sin un segundo join ni una segunda función — si
  -- solo hiciera falta question_id, una plantilla confidencial podría filtrar
  -- sus opciones por un id adivinado aunque la pregunta ya esté escondida.
  job_template_id uuid not null references public.job_templates(id) on delete cascade,
  question_id uuid not null references public.job_template_questions(id) on delete cascade,
  label text not null,
  is_expected boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index job_template_question_options_question_idx on public.job_template_question_options(question_id);
alter table public.job_template_question_options enable row level security;

create policy job_template_question_options_select on public.job_template_question_options
  for select to authenticated
  using (private.can_view_job_template(job_template_id));

create policy job_template_question_options_insert_admin on public.job_template_question_options
  for insert to authenticated
  with check (organization_id = private.auth_org_id() and private.is_admin_or_above());

create policy job_template_question_options_update_admin on public.job_template_question_options
  for update to authenticated
  using (organization_id = private.auth_org_id() and private.is_admin_or_above())
  with check (organization_id = private.auth_org_id() and private.is_admin_or_above());

create policy job_template_question_options_delete_admin on public.job_template_question_options
  for delete to authenticated
  using (organization_id = private.auth_org_id() and private.is_admin_or_above());
```

- [x] **Step 2: Verificar** — `execute_sql`:

```sql
select relname, relrowsecurity from pg_class
where relname in ('job_template_questions','job_template_question_options');
```

Expected: ambas filas con `relrowsecurity = true`.

---

### Task 3: `job_template_stages`

- [x] **Step 1: Aplicar la migración** (`job_template_stages`)

```sql
create table public.job_template_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  job_template_id uuid not null references public.job_templates(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  kind text not null default 'intermedia' check (kind in ('bandeja_entrada','intermedia','contratado','descartado')),
  created_at timestamptz not null default now()
);
create index job_template_stages_template_idx on public.job_template_stages(job_template_id);
alter table public.job_template_stages enable row level security;

create policy job_template_stages_select on public.job_template_stages
  for select to authenticated
  using (private.can_view_job_template(job_template_id));

create policy job_template_stages_insert_admin on public.job_template_stages
  for insert to authenticated
  with check (organization_id = private.auth_org_id() and private.is_admin_or_above());

create policy job_template_stages_update_admin on public.job_template_stages
  for update to authenticated
  using (organization_id = private.auth_org_id() and private.is_admin_or_above())
  with check (organization_id = private.auth_org_id() and private.is_admin_or_above());

create policy job_template_stages_delete_admin on public.job_template_stages
  for delete to authenticated
  using (organization_id = private.auth_org_id() and private.is_admin_or_above());
```

- [x] **Step 2: Verificar** — mismo patrón que Task 2, Step 2, con
  `'job_template_stages'`.

---

### Task 4: `employment_reasons`

**Diferencia deliberada con `rejection_reasons`:** cualquiera que pueda crear una
vacante (todo rol salvo `colaborador`) puede agregar un motivo nuevo inline, no
solo admin+ — es una lista operativa, no una política de rechazo.

- [x] **Step 1: Aplicar la migración** (`employment_reasons`)

```sql
create table public.employment_reasons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  label text not null,
  created_at timestamptz not null default now()
);
create unique index employment_reasons_org_label_key on public.employment_reasons(organization_id, lower(label));
alter table public.employment_reasons enable row level security;

create policy employment_reasons_select on public.employment_reasons
  for select to authenticated
  using (organization_id = private.auth_org_id());

create policy employment_reasons_insert on public.employment_reasons
  for insert to authenticated
  with check (organization_id = private.auth_org_id() and private.auth_role() <> 'colaborador');

create policy employment_reasons_delete_admin on public.employment_reasons
  for delete to authenticated
  using (organization_id = private.auth_org_id() and private.is_admin_or_above());
```

- [x] **Step 2: Verificar** — `execute_sql`:

```sql
select polname, cmd from pg_policies where tablename = 'employment_reasons' order by polname;
```

Expected: 3 filas (`employment_reasons_select` SELECT,
`employment_reasons_insert` INSERT, `employment_reasons_delete_admin` DELETE).

---

### Task 5: `jobs` — columnas nuevas

`salary_min`, `salary_max`, `headcount`, `is_public` ya existen desde Fase 2 — no
se tocan. `employment_type` ya existe con otro significado (tipo de contrato) —
el "Tipo de vacante" del wizard usa un nombre distinto, `vacancy_type`.

- [x] **Step 1: Aplicar la migración** (`jobs_vacancy_type_and_template_link`)

```sql
alter table public.jobs
  add column vacancy_type text check (vacancy_type in ('nueva_posicion','reemplazo','crecimiento')),
  add column employment_reason_id uuid references public.employment_reasons(id),
  add column job_template_id uuid references public.job_templates(id) on delete set null,
  add column candidacy_fields jsonb not null default '{
    "full_name": "required",
    "email": "required",
    "phone": "required",
    "address": "required",
    "resume": "required",
    "cover_letter": "required",
    "additional_files": "required"
  }'::jsonb;
```

- [x] **Step 2: Verificar** — `execute_sql`:

```sql
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'jobs'
  and column_name in ('vacancy_type','employment_reason_id','job_template_id','candidacy_fields')
order by column_name;
```

Expected: 4 filas.

---

### Task 6: `job_questions` + `job_question_options` (copia por vacante)

Mismo shape que las tablas de plantilla del Task 2, pero colgando de `jobs` en
vez de `job_templates`, con `private.can_access_job(job_id)` (ya existe, Fase 4)
en vez de `can_view_job_template`. El escritor real es `createAdminClient()` al
copiar desde la plantilla (mismo patrón que `job_competencies` en `createJob`,
Fase 17) — la política de escritura de abajo es respaldo, no el camino real.

- [x] **Step 1: Aplicar la migración** (`job_questions_and_options`)

```sql
create table public.job_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  job_id uuid not null references public.jobs(id) on delete cascade,
  prompt text not null,
  type text not null check (type in ('open','multiple_choice')),
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index job_questions_job_idx on public.job_questions(job_id);
alter table public.job_questions enable row level security;

create policy job_questions_select on public.job_questions
  for select to authenticated
  using (private.can_access_job(job_id));

create policy job_questions_write_admin on public.job_questions
  for all to authenticated
  using (organization_id = private.auth_org_id() and private.is_admin_or_above())
  with check (organization_id = private.auth_org_id() and private.is_admin_or_above());

create table public.job_question_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  job_id uuid not null references public.jobs(id) on delete cascade,
  question_id uuid not null references public.job_questions(id) on delete cascade,
  label text not null,
  is_expected boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);
create index job_question_options_question_idx on public.job_question_options(question_id);
alter table public.job_question_options enable row level security;

create policy job_question_options_select on public.job_question_options
  for select to authenticated
  using (private.can_access_job(job_id));

create policy job_question_options_write_admin on public.job_question_options
  for all to authenticated
  using (organization_id = private.auth_org_id() and private.is_admin_or_above())
  with check (organization_id = private.auth_org_id() and private.is_admin_or_above());
```

- [x] **Step 2: Verificar** — mismo patrón que Task 2, Step 2.

---

### Task 7: `application_answers` + `applications.prequalified`

Sin política de `insert`/`update`/`delete` para `authenticated` ni `anon` a
propósito — mismo patrón deliberado que `notifications` (Fase 6): el único
camino de escritura es `createAdminClient()` desde `/api/postular`, nunca la
sesión de un usuario ni el rol `anon` directo.

- [x] **Step 1: Aplicar la migración** (`application_answers`)

```sql
alter table public.applications add column prequalified boolean;

create table public.application_answers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  job_id uuid not null references public.jobs(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  job_question_id uuid not null references public.job_questions(id) on delete cascade,
  answer_text text,
  selected_option_id uuid references public.job_question_options(id),
  created_at timestamptz not null default now()
);
create index application_answers_application_idx on public.application_answers(application_id);
alter table public.application_answers enable row level security;

create policy application_answers_select on public.application_answers
  for select to authenticated
  using (private.can_access_job(job_id));
```

- [x] **Step 2: Verificar** — `execute_sql`:

```sql
select polname, cmd from pg_policies where tablename = 'application_answers';
```

Expected: exactamente 1 fila (`application_answers_select`, `SELECT`) — sin
ninguna política de escritura para roles de sesión.

---

### Task 8: `candidates.address` + `applications.cover_letter`

Campos nuevos que hoy no existen en ningún lado — no es ampliar algo oculto, es
capacidad nueva del formulario público (ver spec, sección "Portal público").

- [x] **Step 1: Aplicar la migración** (`candidates_address_and_cover_letter`)

```sql
alter table public.candidates add column address text;
alter table public.applications add column cover_letter text;
```

- [x] **Step 2: Verificar** — `execute_sql`:

```sql
select table_name, column_name from information_schema.columns
where table_schema = 'public'
  and (table_name, column_name) in (('candidates','address'), ('applications','cover_letter'));
```

Expected: 2 filas.

---

### Task 9: Bitácora dentro de la vacante — política de `audit_log`

Hoy `audit_log_select_super_admin` solo deja ver a `super_admin`, y sin chequeo
de organización (hueco documentado en `docs/database.md`, Fase 8 y
`.claude/napkin.md`). Este cambio agrega la rama de vacante (cualquiera con
acceso a esa vacante ve sus eventos) y de paso cierra el hueco de organización
en la rama de `super_admin` — sin ampliar a quién ve el resto de la bitácora
más allá de lo pedido.

- [x] **Step 1: Aplicar la migración** (`audit_log_job_scoped_select`)

```sql
drop policy if exists audit_log_select_super_admin on public.audit_log;

create policy audit_log_select on public.audit_log
  for select to authenticated
  using (
    (private.is_super_admin() and organization_id = private.auth_org_id())
    or (entity_type = 'job' and private.can_access_job(entity_id))
  );
```

- [x] **Step 2: Simular con JWT de prueba** — confirmar que un `gestor`
  colaborador de una vacante ve sus eventos y NO ve eventos de otras entidades:

```sql
begin;
select set_config('request.jwt.claims', json_build_object(
  'sub', (select profile_id from public.job_collaborators limit 1),
  'app_metadata', json_build_object(
    'role', 'gestor',
    'organization_id', (select organization_id from public.job_collaborators limit 1)
  )
)::text, true);
set role authenticated;
select count(*) from public.audit_log
where entity_type = 'job' and entity_id = (select job_id from public.job_collaborators limit 1);
select count(*) from public.audit_log where entity_type <> 'job'; -- esperado: 0
reset role;
rollback;
```

(Si `job_collaborators` está vacía en este ambiente, documentar el resultado
como "sin datos para probar" en vez de forzarlo — no insertar datos de prueba
permanentes fuera de una transacción con `rollback`.)

---

### Task 10: Regenerar tipos, documentar y commitear

- [x] **Step 1: Auditoría de seguridad** — MCP de Supabase, `get_advisors`,
  `type: "security"`. Revisar que no aparezca ninguna tabla nueva sin RLS ni
  ninguna política nueva marcada como riesgo. Si aparece algo, corregirlo con
  una migración adicional antes de seguir.

- [x] **Step 2: Regenerar tipos** — MCP de Supabase,
  `generate_typescript_types`; guardar el resultado completo en
  `src/lib/supabase/database.types.ts` (reemplaza el archivo entero).

- [x] **Step 3: Typecheck** —

Run: `npm run typecheck`
Expected: sin errores (esta fase no toca ningún `.ts`/`.tsx` que consuma las
tablas nuevas todavía, así que el build no debería moverse; si algo rompe, es
una señal de que `database.types.ts` quedó mal generado).

- [x] **Step 4: Documentar en `docs/database.md`** — agregar, después de la
  sección "Fusión de plantilla de vacante + pipeline/competencias (Fase 17)",
  una nueva sección:

```markdown
## Esquema del wizard de plantillas de vacante (Fase 18, 1/7)

Ver `docs/superpowers/specs/2026-09-01-plantillas-vacante-wizard-design.md` para
el diseño completo. Solo esquema y RLS en esta entrega — sin UI todavía.

- `job_templates` gana `created_by`, `is_public`, `status`
  (`draft`/`published`), `is_confidential`, `candidacy_fields` (jsonb,
  tri-estado por campo). `private.can_view_job_template(id)` — función
  `SECURITY DEFINER`, mismo motivo que `candidate_has_accessible_application`
  (Fase 2): sin eso, la política de `job_templates_select` llamándose a sí
  misma via la tabla produce recursión infinita.
- `job_template_questions`/`job_template_question_options`/`job_template_stages`
  — hijas de `job_templates`, mismo patrón de lectura
  (`can_view_job_template`), escritura admin+. Las opciones llevan
  `job_template_id` duplicado (no solo `question_id`) a propósito: sin eso, la
  confidencialidad de la plantilla no cubriría sus propias opciones sin un
  segundo join o una segunda función.
- `employment_reasons` — a diferencia de `rejection_reasons`, el `INSERT` es
  para cualquier rol que pueda crear una vacante (no solo admin+): es una
  lista operativa con alta inline desde el selector, no una política de
  rechazo.
- `jobs` gana `vacancy_type` (Nueva posición/Reemplazo/Crecimiento) —
  deliberadamente NO se llama `employment_type`, esa columna ya existe y
  significa tipo de *contrato* (indefinido/temporal/por obra/pasantía),
  agregada desde Fase 2. `employment_reason_id`, `job_template_id` (solo
  trazabilidad, no se vuelve a leer tras crear la vacante — mismo principio
  de seguridad que Fase 17 con `pipeline_template_id`/`competencies`),
  `candidacy_fields` (copia de la plantilla al crear).
- `job_questions`/`job_question_options` — mismo shape que sus pares de
  plantilla, colgando de `jobs`, `can_access_job(job_id)` en vez de
  `can_view_job_template`.
- `application_answers` — sin política de escritura para ningún rol de
  sesión, mismo patrón deliberado que `notifications` (Fase 6): el único
  camino de escritura es `createAdminClient()` desde `/api/postular`.
  `applications` gana `prequalified` (nullable — `null` si la vacante no
  tiene preguntas de opción múltiple).
- `candidates.address`, `applications.cover_letter` — campos que hoy no
  existen en ningún lado, no una ampliación de algo oculto.
- **Bitácora dentro de la vacante**: `audit_log_select_super_admin` se
  reemplaza por `audit_log_select`, que agrega la rama
  `entity_type = 'job' and can_access_job(entity_id)` — cualquier
  colaborador de esa vacante ve sus propios eventos, no toda la bitácora. De
  paso cierra el hueco de organización documentado en Fase 8 (la rama de
  `super_admin` ahora exige `organization_id = auth_org_id()` también) — sin
  ampliar a quién ve el resto de la bitácora.
```

- [x] **Step 5: Commit**

```bash
git add src/lib/supabase/database.types.ts docs/database.md
git commit -m "$(cat <<'EOF'
feat(bd): esquema y RLS del wizard de plantillas de vacante (Fase 18, 1/7)

Solo esquema — sin UI todavía. job_templates gana confidencialidad,
borrador/publicada y candidatura tri-estado; nuevas tablas de preguntas y
etapas por plantilla y por vacante; jobs gana vacancy_type (distinto de
employment_type, que ya existe) y motivo de vacante; bitácora ahora
visible dentro de cada vacante para su equipo, no solo para super_admin.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Ejecutado — desviaciones reales encontradas

Todas las tareas se ejecutaron y verificaron contra el proyecto real
(`cgudnnlcwcotovcslgzu`). Dos cosas no salieron exactamente como estaba escrito
arriba — documentadas en detalle en `docs/database.md` (sección de esta fase)
y en `.claude/napkin.md`:

1. `job_templates_write_admin` (Fase 15, `FOR ALL`) dejaba ver una plantilla
   confidencial a cualquier admin+ igual, porque `FOR ALL` también cubre
   `SELECT` y las políticas permisivas se combinan con `OR`. Se partió en
   `INSERT`/`UPDATE`/`DELETE` — mismo fix aplicado de entrada a las 3 tablas
   hijas de plantilla (Tasks 2 y 3), no solo a `job_templates`.
2. `created_by` necesitó un `ALTER COLUMN ... SET DEFAULT auth.uid()`
   adicional después del backfill (no estaba en el SQL original del Task 1) —
   sin eso, `createJobTemplate()` rompía. Se detectó con `npm run typecheck`,
   no con la simulación de rol.
3. Un toque de código, mínimo y mecánico: `get-job-templates.ts` amplió su
   lista de columnas del `SELECT` para incluir las 5 nuevas — sin esto el
   tipo devuelto no cumplía `JobTemplate` y el build no compilaba. Ningún
   comportamiento visible cambia (nada en la UI lee todavía esos campos).

`npm run typecheck` y `npm run lint` limpios. `get_advisors(security)` sin
advertencias nuevas (las 2 preexistentes — `pg_net` en `public`, protección de
contraseña filtrada — ya estaban aceptadas desde antes, ver `docs/database.md`).

## Self-Review

**Cobertura del spec:** todas las tablas/columnas de la sección "Modelo de
datos" del spec están cubiertas (Tasks 1-9); la corrección de nombres
(`vacancy_type` vs `employment_type`, columnas que ya existían) quedó reflejada
en el spec commiteado antes de este plan, no solo aquí.

**Placeholders:** ninguno — cada tarea tiene el SQL completo a ejecutar y la
consulta exacta de verificación.

**Consistencia de nombres:** `can_view_job_template(template_id)` se usa
idéntico en Tasks 1, 2 y 3. `can_access_job(job_id)` (función ya existente) se
usa idéntico en Tasks 6, 7 y 9 — no se inventa una función nueva donde ya había
una.

**Fuera de alcance, a propósito:** ninguna pantalla, Server Action ni
componente se toca en esta fase — eso es Fase 18 (2/7) en adelante, cada una
con su propio plan escrito justo antes de ejecutarla.
