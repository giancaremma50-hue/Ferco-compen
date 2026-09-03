# Napkin Runbook — ATS
_Última actualización: 2026-09-02 (pipeline pantalla completa + drawer de candidato + reuniones multi-destinatario)_

## Pipeline pantalla completa + drawer de candidato — MÁXIMA PRIORIDAD

1. **[2026-09-02] BUG REAL, encontrado en review antes de commitear: "Asignar tarea" se ocultaba en la UI detrás de `canDecideApplication` (approver/owner), pero `addTask` en el servidor solo exige `can_access_job` (cualquier colaborador con acceso a la vacante) — la UI insinuaba una garantía de seguridad que el servidor nunca tuvo.** No era una fuga nueva (`candidate_tasks` siempre fue de nivel más permisivo), pero ocultar el botón sin restringir el server es peor que no ocultarlo: alguien podía pensar que ese nivel de protección existía. Do instead: cuando un botón de la UI se oculta por un permiso, verificar que la Server Action detrás exige ese mismo nivel — si exige uno más laxo, la UI no debe fingir uno más estricto. Corregido quitando el `hidden` de "Asignar tarea" (igual que "Seguimientos", que ya estaba correctamente sin ese gate por la misma razón).
2. **[2026-09-02] BUG REAL: el fetch de datos del drawer (`getApplicationDrawerData`) no tenía `.catch()` — un fallo de red dejaba el skeleton de carga para siempre, sin mensaje ni salida.** `loading` nunca volvía a `false` si la promesa rechazaba. Corregido con `.catch()` que llama `notifyError` y baja `loading`, más un estado explícito "No se pudo cargar esta postulación" en vez de asumir que `!loading` implica `data` presente.
3. **[2026-09-02] `interviews.interviewer_id` (un solo entrevistador) reemplazado por `interview_attendees` (tabla nueva, varios destinatarios reales) — la tabla estaba vacía en producción (0 filas), se pudo rediseñar limpio sin backfill.** `interviewer_id` quedó nullable en vez de dropeada de una — más barato revertir si algo se pasó por alto; ya no se escribe en ningún lado.
4. **[2026-09-02] Patrón: el drawer de candidato se remonta por `key={applicationId ?? "closed"}` en el padre (`KanbanBoard`) en vez de resetear su estado local dentro de un `useEffect`.** El lint `react-hooks/set-state-in-effect` (ERROR real de build, no warning) bloqueaba `setLoading(true)`/`setData(null)` síncronos al inicio de un efecto — la solución no fue silenciar el lint, fue dejar que el cambio de `key` remonte el componente entero cuando cambia el candidato seleccionado, así el estado local nace limpio solo. Efecto colateral bueno: elimina la condición de carrera entre abrir el candidato A y B rápido (la promesa vieja de A no puede escribir sobre un componente ya desmontado). Misma trampa, mismo arreglo en `interview-form.tsx`: el reset de `attendeeIds` se movió del `useEffect` que observa `state` al wrapper `action()` mismo, justo después de `await boundAction(...)`.
5. **[2026-09-02] CV siempre servido con URL firmada generada en el momento del clic (`getCvViewUrl`), nunca pre-cargada al abrir el drawer.** El drawer puede quedar abierto mucho más de 60s (vigencia de la firma) — pedirla al abrir la habría dejado vencida antes de que alguien la use.
6. **Gotcha de entorno (Windows/PowerShell): `Remove-Item` encadenado en el mismo comando justo después de un `WriteAllText` sobre `database.types.ts` truncó el archivo a 0 bytes una vez, sin motivo claro ("Remove-Item on system path blocked").** Recuperado con `git checkout -- src/lib/supabase/database.types.ts` (archivo limpio/tracked, sin pérdida). Do instead: la limpieza de archivos temporales después de regenerar tipos se hace con Bash `rm`, nunca con `Remove-Item` de PowerShell, en un paso separado.
7. **[2026-09-02] BUG REAL, encontrado en review antes de commitear: en el rediseño de "Destinatarios" de `MeetingScheduler` (buscador + chips en vez de checkboxes), el nuevo `<input>` de búsqueda vivía dentro del mismo `<form>` que el botón "Confirmar" — Enter en el buscador disparaba el submit implícito del formulario en cuanto ya había 1 destinatario agregado (el botón se habilita con `attendeeIds.length > 0`), agendando la reunión (con envío real de correo/enlace de calendario) antes de terminar de buscar al siguiente colega.** Do instead: cualquier `<input type="text">` que se agregue dentro de un `<form>` que ya tiene un submit habilitable necesita `onKeyDown` con `preventDefault()` en Enter si su propósito es "buscar/filtrar", no "confirmar" — el submit implícito de HTML es fácil de olvidar al convertir una lista estática (checkboxes) en un buscador vivo.
8. **[2026-09-02] Verificado en vivo (SQL contra Supabase) antes de quitar un gate: `job_collaborators_select` (RLS) solo exige `can_access_job(job_id)`, igual que todo lo demás que la página de pipeline ya lee — el gate `ADMIN_ROLES.has(profile.role)` que existía en /vacantes/[id] para `getJobCollaborators` era solo para permitir GESTIONAR (agregar/quitar) colaboradores, no una restricción de visibilidad.** Se pudo mostrar el equipo de reclutamiento (encargado + colaboradores) de solo lectura en `JobInfoModal` sin ese gate, sin abrir ningún hueco nuevo. Do instead: un gate de rol en la UI puede existir por razones de *gestión* (quién puede editar), no de *visibilidad* (quién puede ver) — antes de copiar un gate a un contexto de solo lectura, revisar CUÁL de las dos razones lo puso ahí, no asumir que aplica igual.

---

## Fase 19 — Endurecimiento — MÁXIMA PRIORIDAD

1. **[2026-09-02] BUG REAL, cross-tenant, arrastrado desde Fase 7: `error_reports_select`/`update`/`delete` y `error_report_messages_select` solo miraban `is_super_admin()`, nunca `organization_id`.** Ya estaba documentado como límite conocido ("sin impacto real hoy, un solo tenant") — se cerró de una vez al entrar a auditar RLS para Fase 19, mismo patrón que el resto de la base evita a propósito. Verificado con simulación real: JWT de `super_admin` con un `organization_id` fabricado distinto al del reporte real → `select count(*) from error_reports` da `0`; con el `organization_id` real → da `1`. Do instead: un "sin impacto real hoy" documentado en el napkin no es lo mismo que "resuelto" — sigue siendo deuda real, se cierra en cuanto se vuelve a tocar esa zona del código, no se posterga indefinidamente solo porque hoy no hay un segundo tenant que lo explote.
2. **[2026-09-02] Casi se filtra una consulta a una base de datos de PRODUCCIÓN de OTRO proyecto — el conector genérico `mcp__supabase__*` (recién reconectado tras una caída) apunta a un Supabase completamente distinto al de este ATS (`cgudnnlcwcotovcslgzu`), con tablas reales de nómina/salarios/evaluaciones de Ferco.** Se detectó a tiempo (2 llamadas de solo lectura, `get_advisors`/`list_tables`, ningún dato sensible leído) porque el resultado no calzaba con ninguna tabla conocida del ATS — se paró, se avisó al usuario de inmediato (regla de "advertencia de seguridad", sin comprimir el mensaje), y se siguió exclusivamente con el conector correcto (`mcp__a6cac10a-2564-4d8a-a158-2878e9b36cc1__*`, ya scopeado por `project_id`). Do instead: **cuando este entorno tiene más de un conector de Supabase disponible, usar siempre el que ya viene scopeado por `project_id` de este proyecto — nunca el genérico** — un resultado que no reconoces (nombres de tabla que nunca viste en este repo) es la señal de alarma, parar ahí mismo, no seguir "a ver qué sale".
3. **[2026-09-02] CSP con nonce por request, implementado siguiendo la guía oficial de Next 16 al pie de la letra (`node_modules/next/dist/docs/.../content-security-policy.md`), no de memoria.** `script-src` queda estricto (`'nonce-{x}' 'strict-dynamic'`, sin `unsafe-inline` ni `unsafe-eval` en producción) — la directiva que de verdad frena XSS por script inyectado. `style-src` se dejó con `'unsafe-inline'` a propósito: el acento configurable por organización (regla de diseño ya fija del proyecto) se aplica en decenas de puntos con `style={{...}}` inline porque el valor es dinámico en tiempo de ejecución — nonce-ar cada uno habría sido una migración grande, y este entorno no tiene navegador con credenciales reales para verificar que no se rompió nada. Do instead: cuando una directiva estricta chocaría con un patrón ya establecido y extendido en el código (no un caso aislado), es mejor relajar ESA directiva específica con la razón documentada en el propio código, que forzar el endurecimiento completo sin poder probarlo.
4. **[2026-09-02] Detalle no obvio de la implementación de nonce: `updateSession()` no puede tomar una sola copia de `request.headers` al principio de la función.** El helper que arma cada `NextResponse.next({request: {headers}})` se volvió a llamar cada vez que hace falta una respuesta nueva (`nextResponse()`, reconstruida desde `request.headers` en cada llamada) en vez de una sola copia guardada al inicio — porque `setAll()` de Supabase muta las cookies del `request` original a mitad de la función (rotación de sesión), y una copia de headers tomada antes de esa mutación se habría quedado con el Cookie header viejo, rompiendo el refresh de sesión silenciosamente para cualquier request que necesitara rotar el token.
5. **[2026-09-02] Auditoría RLS de las 17 tablas de Fases 8-18 (`candidate_tasks`, `application_competency_scores`, `message_templates`, `interviews`, `candidate_segments`, `job_templates` + 3 satélite, `employment_reasons`, `job_questions`/`options`, `application_answers`, `job_collaborators`, `audit_log`, `profile_invites`): todas correctas.** Dos observaciones de severidad baja, aceptadas sin corregir por ahora: (a) `candidate_segments_select` es visible para cualquier miembro autenticado de la organización, incluido `colaborador` — no expone candidatos (son solo metadatos de filtro guardado), pero el rol no debería tocar esa función según la matriz de roles; (b) el `DELETE` de `candidate_tasks`/`interviews` permite a quien lo creó borrarlo aunque haya perdido el acceso a la vacante después (no revalida `can_access_job` en el DELETE, solo en INSERT/SELECT/UPDATE) — caso de borde raro, no se tocó.
6. **[2026-09-02] `/security-review` completo de `src/` (Zod en Server Actions/Route Handlers, uso de `createAdminClient()` en los 8 call sites reales, XSS, inyección SQL, open redirect, cobertura de rate limiting, autorización en Server Actions): sin hallazgos.** El punto que más esfuerzo se le dedicó fue `createAdminClient()` (bypasea RLS por diseño) — cada llamada se leyó completa, no solo se grepeó el nombre, para confirmar que el `organization_id` usado en cada escritura viene de una fuente ya validada (una fila leída antes con el cliente de sesión, o un id explícito del actor) y nunca de un valor que el cliente pueda inventar.

---


## Bolsa de empleo aspiracional — MÁXIMA PRIORIDAD

1. **[2026-09-02] BUG REAL, encontrado en review antes de commitear: héroe de portada quedaba vacío si la organización solo sube video (sin foto) y el visitante tiene `prefers-reduced-motion` activo.** `HeroBackgroundMedia` cae a `return null` en ese caso (correcto — no fuerza un video con movimiento a quien lo pidió apagado), pero la sección del héroe en `/empleos` no tenía ningún color de fondo propio detrás del componente de media — sin nada que renderizar, quedaba una franja de 72vh con solo el degradado oscuro flotando sobre el fondo claro de la página. Do instead: cuando un componente de media puede legítimamente no renderizar nada (fallback de accesibilidad, no error), el contenedor que lo envuelve necesita su propio color de fondo de respaldo — no asumir que "siempre va a haber algo debajo". Corregido con `backgroundColor: organization.accent_color` en la sección, mismo patrón que ya usaba `/login` (que si tenía el fondo de acento en su contenedor desde antes).
2. **[2026-09-02] RLS gap real, mismo patrón que Fase 18 (`job_questions_select_public`): `departments` solo tenía política `to authenticated`, invisible para el portal público (`anon`).** Un `join jobs → departments(name)` desde `/empleos` (sesión anónima) habría devuelto `null` en el nombre del departamento para TODO visitante, en silencio — sin RLS de por medio no habría error, solo un dato ausente. Verificado con una simulación real: insertar un departamento + vacante de prueba dentro de una transacción, `set role anon`, confirmar que el join sí trae el nombre, `rollback`. Do instead: **toda tabla nueva que un join desde el portal público necesite leer, aunque sea de paso (no la tabla "principal" de la página), necesita su propia política `to anon`** — la tabla puede llevar años existiendo y funcionando bien para el uso interno; el gap solo aparece cuando alguien la usa desde un contexto sin sesión por primera vez.
3. **[2026-09-02] Antes de escribir código nuevo para "video de portada", se verificó que el mecanismo YA existía (video de fondo del login, sesión anterior) y solo hacía falta generalizarlo — no reinventarlo.** `createLoginVideoUploadUrl`/`confirmLoginVideoUpload`/`removeLoginVideo` (3 funciones atadas a una sola columna) pasaron a `createBrandVideoUploadUrl`/`confirmBrandVideoUpload`/`removeBrandVideo` parametrizadas por un `BrandVideoField` (`"login_video_url" | "careers_cover_video_url"`), mismo patrón que `BrandImageField` ya usaba para 3 imágenes distintas. El nombre de archivo en Storage (`VIDEO_PATH_STEM`) se mantuvo separado del nombre de columna a propósito — `login_video_url` sigue escribiendo en el path `login_video` que ya tenían las organizaciones existentes; cambiarlo para "que combine" con el nombre de columna habría dejado huérfanos los videos ya subidos. Verificado en review que un campo no puede confirmar la ruta de otro campo (cross-field path confusion) — `brandVideoPaths(orgId, field)` está scopeada por campo, no solo por organización.
4. **[2026-09-02] El bucket `marca-publico` ya tenía `file_size_limit`/`allowed_mime_types` correctos para video (20 MB, incluye `video/mp4`/`video/webm`) desde la sesión anterior que agregó el video de login — se verificó en vivo antes de asumir que hacía falta otra migración de Storage.** Cero cambios de bucket necesarios para la portada de la bolsa de empleo, porque reusa el mismo bucket con los mismos límites. Do instead: antes de agregar un tipo de archivo nuevo a un flujo de subida, confirmar el estado REAL del bucket (`select file_size_limit, allowed_mime_types from storage.buckets`) — puede que ya esté cubierto por un cambio anterior, no asumir que hace falta una migración nueva solo porque el campo de la app es nuevo.
5. **[2026-09-02] Decisión: el filtrado de la lista de vacantes es 100% en cliente (estado de React), no por `searchParams` de URL.** El primer diseño usaba `router.replace()` en cada `onChange` del buscador de texto — funciona, pero navega/re-renderiza el árbol del servidor en cada tecla, para una lista que de todos modos ya se trajo completa (son pocas vacantes, sin paginación). Cambiado a filtrar en memoria con `useMemo` sobre datos ya cargados — instantáneo, sin round-trip. El costo real (URLs de filtro ya no son compartibles/bookmarkeables) se aceptó a propósito: nadie pidió esa capacidad, y el listado es corto.

---


## Tour contextual: wizard de plantilla de puesto + Nueva vacante — MÁXIMA PRIORIDAD

Pedido real del usuario: el tour de `driver.js` que ya existía (Fase post-7) solo señala
íconos del menú una vez en el primer login — no enseña a llenar nada. Se agregó un
botón "¿Cómo funciona esto?" (`src/components/ui/help-tour-button.tsx`, reutiliza la
misma librería) en cada uno de los 6 pasos del wizard y en "Nueva vacante" — a demanda,
sin persistencia, se puede abrir cuantas veces haga falta.

1. **[2026-09-02] Redactar contenido de ayuda es tan revisable como código — 2 de las ~20 descripciones escritas eran incorrectas, encontradas por un review dedicado, no por typecheck/build.** Una decía que publicar una plantilla exige al menos una etapa intermedia (falso: `publishTemplate` solo exige que `job_template_stages` no esté vacío, y el paso 4 siempre inserta las 3 etapas fijas al guardarse — el gate real es "haber pasado por el paso 4 una vez", no "tener una etapa intermedia"). Otra decía que una postulación precalificada se ve como insignia en el pipeline — no existe esa UI, `KanbanCard` solo expone nombre y rating. Do instead: contenido de ayuda que describe comportamiento real del sistema necesita el mismo nivel de verificación que una migración — cada afirmación se contrasta contra el código que la implementa, no se redacta de memoria/intuición aunque "suene razonable".
2. **`HelpTourButton` filtra en silencio cualquier paso cuyo `selector` no matchee nada en el DOM en el momento del clic — un `data-tour` mal escrito no rompe nada, simplemente ese paso nunca aparece.** Mismo patrón que `OnboardingTour` (Fase post-7) — deliberado, un tour no debe reventar la página por un elemento condicional que no está montado. Pero significa que un typo en el string del selector es indetectable por build/typecheck, solo por lectura cuidadosa o probando en navegador real. Este entorno no tiene salida a `*.supabase.co` (ver nota de entorno, Fase 17) — se verificó por inspección + un review dedicado a comparar cada `data-tour="X"` contra su `HELP_STEPS`, no en navegador.
3. **Decisión: este tour es a demanda (botón "?"), no forzado como el de navegación.** El de navegación se muestra una sola vez porque orienta sobre algo que se ve siempre (el menú); el de una pantalla de contenido denso (el wizard) tiene sentido reabrirlo meses después cuando ya nadie se acuerda — forzarlo una sola vez sería inútil la segunda vez que alguien vuelve a crear una plantilla.

---


## Auditoría de secretos en el repo público — MÁXIMA PRIORIDAD

1. **[2026-09-02] BUG REAL: `.env.example` nunca estuvo en el repo — `.gitignore` tenía `.env*` sin ninguna excepción, así que el archivo se ignoraba en silencio cada vez que alguien intentaba agregarlo.** El repo es **público** en GitHub. README y `docs/PENDIENTE.md` hablaban de él como si existiera (`cp .env.example .env.local`, "limpiar 2 variables muertas de `.env.example`") — nadie lo había notado porque el resto del setup igual funciona si ya tienes las variables de otra fuente. Fix: `!.env.example` agregado al `.gitignore`, archivo recreado desde cero con las 6 variables reales (grep de `process.env.` en `src/`), sin las 2 variables fantasma (`ALLOWED_EMAIL_DOMAIN`/`SUPER_ADMIN_EMAIL`) que ningún archivo leía. Do instead: un patrón `.env*` en `.gitignore` es correcto para no commitear secretos, pero SIEMPRE necesita `!.env.example` al lado — si no, el único archivo que SÍ debería versionarse (la plantilla sin valores) desaparece con el resto.
2. **[2026-09-02] Verificado, no hay secretos reales filtrados en la historia completa del repo (67 commits, `git log --all -p`).** Sin JWT (`eyJ...`), sin `SUPABASE_SERVICE_ROLE_KEY=`/`RESEND_API_KEY=re_`/`ANTHROPIC_API_KEY=sk-` con valor real, sin claves AWS (`AKIA...`), sin `client_secret` de Google (`GOCSPX-...`), sin connection strings con contraseña embebida, sin archivos `.pem`/`.key`/`credentials.json` jamás commiteados. `gh api repos/.../secret-scanning/alerts` también devuelve `[]` — confirmación independiente de GitHub. Do instead: en un repo público, repetir este chequeo (`git log --all -p` + grep de patrones de secretos + `gh api .../secret-scanning/alerts`) antes de cualquier auditoría de seguridad más profunda — es gratis y descarta la categoría de hallazgo más grave de entrada.

---


## Mejoras post-Fase 7 (invitaciones, avatar, video de login) — MÁXIMA PRIORIDAD

1. **[2026-09-02] BUG REAL, crítico: el límite real de tamaño/tipo de un bucket de Storage vive en `storage.buckets`, no en la Server Action.**
   Causa: se agregó soporte para subir un video de fondo al login reusando el bucket `marca-publico`, pero ese bucket ya tenía `file_size_limit = 5MB` y `allowed_mime_types` restringido a imágenes desde su creación en Fase 3 — cualquier validación de tamaño/tipo en la Server Action (`createLoginVideoUploadUrl`) era pura decoración: Storage habría rechazado el video de todos modos, con o sin esa validación.
   Do instead: antes de asumir que una Server Action "ya protege" un límite de subida, verificar `select file_size_limit, allowed_mime_types from storage.buckets where id = '...'` — si el límite real del bucket es más estricto (o no incluye el mime type nuevo), hay que actualizarlo con una migración, la validación de la app es solo la primera capa, no la única.

2. **[2026-09-02] BUG REAL, crítico: una policy de RLS "solo super_admin" en una tabla de invitación bloquea al propio invitado leer su fila.**
   Causa: `profile_invites_super_admin` exige `is_super_admin()` tanto en `USING` como en `WITH CHECK` — correcto para que solo un super admin cree/borre invitaciones, pero un `gestor`/`admin` recién invitado NUNCA podría ver su propia fila con el cliente de sesión. El primer intento de usar esto para eximir del filtro de dominio corporativo (`auth/callback/route.ts`) consultaba con el cliente de sesión y siempre devolvía 0 filas — el login de cualquier invitado que no fuera super_admin se rechazaba y su cuenta recién creada se borraba.
   Do instead: cuando la verificación es "¿existe una excepción para ESTA persona?" y la tabla que la guarda solo es legible por un rol superior, la lectura tiene que hacerse con `createAdminClient()`, nunca con el cliente de sesión del propio afectado — el mismo patrón ya documentado para `pipeline_templates`/`job_stages` en Fase 4, aplicado aquí a auth.

3. **[2026-09-02] BUG REAL: borrar un registro de "úsalo una vez" que también sostiene una verdad PERMANENTE rompe esa verdad en el segundo uso.**
   Causa: al arreglar el punto 2, la primera corrección borraba la fila de `profile_invites` apenas se usaba para dejar entrar al invitado. Pero el filtro de dominio corre en CADA login, no solo el primero — sin la fila, el mismo invitado quedaba expulsado (y su cuenta borrada) en su SEGUNDO login.
   Do instead: cuando un mismo registro sirve para dos cosas de vida distinta ("asignar un rol una vez" vs. "eximir del filtro de dominio para siempre"), no se borra — se marca con una columna `consumed_at` (o similar). La bandeja de "pendientes" filtra por `consumed_at is null`; la verificación de acceso ignora ese campo y solo mira si la fila existe.

4. **[2026-09-02] Volver un campo de texto libre en un `z.enum()` sobre una tabla ya viva puede corromper datos existentes en el próximo `UPDATE`, no solo rechazar los nuevos.**
   Causa: "País" pasó de `<input>` a `<select>` con 4 opciones fijas. Una vacante con un país que no esté en esas 4 opciones haría que el `<select>` cayera en la primera opción real sin que nadie lo notara, y esa vacante se guardaría con el país cambiado por accidente al editar cualquier otro campo.
   Do instead: antes de cerrar un campo existente a una lista fija, correr `select distinct <columna> from <tabla>` contra la base real — si hay valores fuera de la lista, mostrarlos como opción aparte (deshabilitada) en el `<select>` para que se note y haya que elegir uno real, en vez de dejar que el navegador la reemplace en silencio. La validación del schema (Zod) debe seguir rechazando el valor viejo — la UI solo evita que se pierda sin que nadie lo vea, no reintroduce el valor viejo como válido.

5. **`next.config.ts` → `images.remotePatterns` necesita CADA hostname externo real, no solo el de Storage.**
   Causa: `profiles.avatar_url` se llena con la foto de Google desde Fase 3 (`handle_new_user()`), pero el header nunca la mostraba — ni siquiera se había notado que `next/image` la habría bloqueado igual, porque `remotePatterns` solo tenía `*.supabase.co`. Sin `*.googleusercontent.com`, la foto de Google jamás habría cargado aunque el código la usara.
   Do instead: cada vez que se empieza a renderizar una URL externa nueva con `next/image` (no solo Storage — CDNs de terceros como Google, Gravatar, etc.), verificar `next.config.ts` antes de asumir que "ya está permitido porque otras imágenes cargan".

6. **Subir un archivo grande (video) por una Server Action choca con el límite de tamaño de body de las funciones de Vercel — subir directo del navegador a Storage con una URL firmada lo evita.**
   Do instead: `supabase.storage.from(bucket).createSignedUploadUrl(path, {upsert})` en el servidor (autoriza la ruta vía RLS de `storage.objects`, requiere permiso de INSERT) → el navegador sube con `supabase.storage.from(bucket).uploadToSignedUrl(path, token, file, {contentType})` usando el cliente browser (el token ya autoriza esa subida puntual, no necesita sesión) → una segunda Server Action confirma y guarda la URL pública. Nada del archivo en sí pasa por Next.

7. **Descartar el `error` de una consulta y tratar "no hay dato" como "la condición es falsa" es peligroso cuando la rama por defecto es destructiva.**
   Causa: la primera versión de la excepción de dominio en `auth/callback` ignoraba `error` al leer `profile_invites` — un fallo transitorio de red se habría tratado igual que "no está invitado", y la rama de rechazo BORRA la cuenta recién creada. Un error de verdad no es lo mismo que "no existe".
   Do instead: cuando la rama "no encontrado" de una consulta dispara una acción irreversible (borrar, expulsar), revisar `error` por separado y mandar a un estado reintentable (no destructivo) si la consulta en sí falló — nunca asumir "no" cuando en realidad es "no se pudo saber".

8. **Límite pendiente, documentado a propósito: invitar a alguien directamente con rol `super_admin` deja su fila de `profile_invites` como "pendiente" para siempre.**
   Causa: el chequeo de invitación solo corre dentro de `if (domainMismatch && profile.role !== "super_admin")` — cualquier super_admin ya está exento del filtro de dominio desde antes (Fase 3), así que ese bloque nunca se ejecuta para ellos y `consumed_at` nunca se marca.
   Do instead: aceptado como límite conocido, no corregido — invitar directamente como super_admin es un caso raro (alguien de máxima confianza normalmente se promueve manualmente desde Usuarios después de su primer login normal, no por invitación). Si esto molesta en la práctica, la corrección sería sacar el chequeo/marcado de `consumed_at` del `if` de dominio y hacerlo siempre que exista una fila de invitación, aceptando una consulta extra en cada login de alguien invitado.

---

---


## Lista de plantillas nunca se conectó al wizard nuevo (post-Fase 18) — MÁXIMA PRIORIDAD

Reporte real del usuario: "el configurador de plantillas no quedó como lo pedí". Causa
real: `/configuracion/plantillas-vacante` (el listado) seguía usando el modal plano de
Fase 15 (`JobTemplateDialog`) para "Nueva plantilla" y "Editar" — el wizard de 6 pasos
de Fase 18 solo era alcanzable desde "Continuar" (solo plantillas en borrador) o desde
"Crear vacante" cuando no había ninguna plantilla todavía. El spec
(`docs/superpowers/specs/2026-09-01-plantillas-vacante-wizard-design.md:3`) decía
literal "Reemplaza el flujo actual" — nunca se hizo, el modal viejo quedó viviendo en
paralelo sin que nadie lo notara porque seguía "funcionando".

1. **[2026-09-01] Lección de proceso, no bug de código: un spec que dice "reemplaza X" no confirma solo con que lo nuevo compile y funcione — hay que verificar que lo viejo de verdad se desconectó de la UI.** El modal de Fase 15 se mantuvo deliberadamente actualizado durante Fase 18 (`createJobTemplate` ya insertaba con `status: 'published'`, tenía su propio helper `syncTemplateStagesFromPipeline` para no dejar `job_template_stages` vacío) — alguien SÍ pensó en mantenerlo compatible con el nuevo esquema, pero nadie volvió a la pantalla que lo dispara para apagarlo. Do instead: al cerrar cualquier fase que dice "reemplaza" un flujo viejo, grep del componente/acción vieja para confirmar 0 referencias reales en `src/app` — no alcanza con que el flujo nuevo exista y pase build.
2. **[2026-09-01] Borrado, no bug: `JobTemplateDialog`, `createJobTemplate`/`updateJobTemplate`, `JobTemplateSchema` y `sync-stages-from-pipeline.ts` completos.** `job-template-row.tsx` ahora manda "Continuar" (borrador, a `paso-{wizard_step}`) o "Editar" (publicada, a `paso-1`) al wizard; `plantillas-vacante/page.tsx` manda "Nueva plantilla" a `/nueva`. Verificado con 2 revisores en paralelo: el paso 6 (`publishTemplate`) bloquea publicar sin etapas (mismo gate que tenía el helper borrado), ningún `update*Step` toca `status` salvo `publishTemplate` (reabrir una plantilla publicada no la revierte a borrador), pasos 3/4 son borra-e-inserta (reabrir no duplica preguntas/etapas), y `createJob` copia las filas de la plantilla a tablas propias de la vacante al crearla — nada queda con referencia viva a lo que se edite después en la plantilla.
3. **[2026-09-01] Cascada de código muerto: borrar el punto de entrada de un flujo puede dejar huérfano lo que solo ÉL consumía, no solo lo que consume directamente.** `getPipelineTemplateOptions`/`PipelineTemplateOption` (`pipeline-templates/get-pipeline-templates.ts`) solo existían para alimentar el selector de pipeline del modal viejo — al borrar el modal, quedaron sin ningún llamador. Encontrado por el review (angle "removed-behavior"), no por grep manual inicial. Do instead: tras borrar un componente/acción, grep también los HELPERS que ese componente importaba — no solo confirmar que el componente en sí ya no se usa.

---

## Auditoría de buckets de Storage (post-Fase 18) — MÁXIMA PRIORIDAD

Disparada por un reporte real del usuario: falló subir la "imagen del inicio
de sesión" desde `/configuracion/marca`. Se verificó `storage.buckets` y las
políticas de `storage.objects` en vivo (`execute_sql` contra el proyecto,
simulación de rol con `request.jwt.claims`) — RLS de `marca-publico`/`cvs-privado`
está bien, los 2 bugs reales estaban en otro lado.

1. **[2026-09-01] BUG REAL: Next.js limita a 1 MB el body de toda Server Action por defecto — `next.config.ts` nunca lo overrideaba, aunque el configurador de marca admite imágenes de hasta 5 MB.**
   `uploadBrandImage` (`src/lib/organizations/actions.ts`) valida tamaño/tipo con Zod después de recibir el `FormData`, pero Next.js corta la solicitud ANTES de que ese código corra si el body pasa de 1 MB — la "imagen del inicio de sesión" (recomendada 1200x1600 vertical) fácilmente pesa más que eso. El candidato ve un error crudo de Next, no el mensaje en español del catálogo. Do instead: `experimental.serverActions.bodySizeLimit` en `next.config.ts` SIEMPRE tiene que ser ≥ el límite más grande que valide cualquier Server Action del código (+ margen por overhead de `multipart/form-data`, la doc de Next recomienda 10-20 KB) — un límite de archivo en Zod que nunca se compara contra este config es una validación que puede no alcanzar a ejecutarse nunca.

2. **[2026-09-01] BUG REAL, silencioso: el bucket `cvs-privado` tenía `allowed_mime_types` configurado solo para CVs (PDF/DOC/DOCX) — nunca se actualizó cuando Fase 18 agregó "archivos adicionales" (PDF/JPG/PNG) a `/api/postular`.**
   El código de la app sí permite JPG/PNG (`ALLOWED_ADDITIONAL_TYPES` en `src/app/api/postular/route.ts`), pero Supabase Storage rechaza la subida a nivel de bucket antes de que la RLS o el código importen — y ese error se trata como "best-effort" (`continue`, sin avisar al candidato). Resultado: TODO archivo adicional que fuera imagen se perdía en silencio, en cada postulación, desde el primer commit de Fase 18 — la postulación seguía viéndose exitosa. Corregido con `update storage.buckets set allowed_mime_types = array[...] where id='cvs-privado'` agregando `image/jpeg`/`image/png`. Do instead: **el tipo MIME permitido vive en 2 lugares que tienen que coincidir** — el `Set` de la app y `storage.buckets.allowed_mime_types` — cambiar solo uno dos dejarlo pasar en un lado y morir en silencio en el otro. Verificar ambos con `select allowed_mime_types from storage.buckets` cada vez que se agregue un tipo de archivo nuevo a cualquier flujo de subida.

3. **[2026-09-01] Aviso, no bug: el proyecto Supabase de este ATS tiene 2 buckets que el código de este repo nunca referencia — `archivos` (público, sin límite de tipo/tamaño) y `archivos_planes`/`firmas` (política de solo-lectura para `authenticated`).** Ninguno aparece en `docs/database.md` ni en ningún `storage.from(...)` de `src/`. Probablemente resto de otro proyecto compartiendo el mismo proyecto Supabase — no se tocaron, solo se deja constancia por si el usuario no esperaba que estuvieran ahí.

---

## Pestaña Pipelines eliminada + "guardar como set reutilizable" (Fase 18)

Cierra la pieza que quedó pendiente tras portal público: con el wizard ya
pudiendo crear `pipeline_templates` nuevos desde su propio paso "Etapas"
(checkbox "Guardar estas etapas intermedias como un set reutilizable"),
se cumple la condición para quitar `/configuracion/pipelines` — pantalla,
componentes (`pipeline-stages-editor.tsx`, `pipeline-template-form.tsx`,
`pipeline-template-row.tsx`) y `pipeline-templates/actions.ts` completo,
borrados.

1. **[2026-09-01] BUG REAL: `createPipelineTemplate` (Fase 15, ya borrado) manejaba `error.code === "23505"` para un nombre repetido — pero nunca existió un índice único que hiciera posible ese código de error. Confirmado consultando `pg_indexes` directo: solo estaba el índice único parcial de `is_default`, ninguno sobre `name`.**
   El pre-check de la nueva función (`.ilike` antes de insertar) tenía la misma falsa sensación de seguridad — sin restricción real, dos guardados casi simultáneos con el mismo nombre nuevo pasaban los dos. Agregado `pipeline_templates_org_name_key` (índice único en `(organization_id, lower(name))`), mismo patrón que `employment_reasons_org_label_key` (Fase 18, 1/7). Do instead: un `catch` de `error.code === "23505"` en código viejo NO es evidencia de que la restricción real existe — confirmarlo consultando `pg_indexes`/`pg_constraint` directo antes de asumir que "ya está cubierto en otro lado".

2. **[2026-09-01] BUG REAL: crear una fila padre y luego una fila hija dependiente en dos pasos separados, sin revertir la primera si la segunda falla, deja un registro fantasma (nombre sin contenido) que la UI sigue ofreciendo como opción válida.**
   Si `pipeline_templates` se insertaba bien pero `pipeline_template_stages` fallaba, quedaba un set con nombre y 0 etapas — "Empezar desde un set guardado" lo seguía listando, y elegirlo vaciaba la plantilla de quien lo intentara, sin ningún beneficio. Corregido: si el segundo insert falla, se borra la fila padre recién creada. Do instead: cualquier "crear padre, luego hijo" en dos pasos sin transacción real necesita el rollback manual del padre si el hijo falla — no dejarlo mudo esperando a que alguien lo note en la lista.

3. **[2026-09-01] Decisión, aceptada y no corregida: ya no hay forma de RE-designar qué `pipeline_templates` es la "predeterminada" de la organización — `setDefaultPipelineTemplate` se borró junto con la pantalla, y nada la reemplaza.**
   Solo importa para el diálogo plano viejo (Fase 15) cuando no se elige ningún pipeline al crear una plantilla — cada vez más un camino secundario ahora que el wizard es el principal. Construir una UI nueva solo para esto era alcance no pedido; se documenta como límite conocido, no se inventó una pantalla nueva para un caso que hoy casi no se usa.

---

## Portal público dinámico (Fase 18) — MÁXIMA PRIORIDAD

1. **[2026-09-01] BUG REAL, encontrado ANTES de que llegara a producción (se probó con simulación de rol antes de dar la migración por buena): una tabla nueva con SELECT solo para `can_access_job()` es invisible para el portal público sin autenticar — `can_access_job()` nunca contempla el rol `anon`.**
   `job_questions`/`job_question_options` (Fase 18, esquema) se diseñaron pensando en el uso INTERNO (RH viendo las preguntas de una vacante) y se les olvidó el otro consumidor real: el visitante anónimo del portal, que necesita ver esas mismas preguntas para responderlas. Sin la política `to anon` agregada acá, el portal público habría mostrado un formulario sin preguntas para SIEMPRE, sin ningún error visible — simplemente `[]`. Do instead: toda tabla nueva que un flujo público (sin sesión) necesita leer necesita su PROPIA política con `to anon` — no alcanza con que la tabla "ya tenga RLS", cada rol que de verdad la va a consultar necesita su propia condición explícita. Mismo patrón que `jobs_select_public` (ya existía) — buscarlo como referencia antes de escribir la política nueva, no reinventar el criterio.

2. **[2026-09-01] Decisión: `parseCandidacyFields()` normaliza cualquier `jsonb` no válido a "required" (el default más estricto), no a "hidden" ni a un error 500.**
   `candidacy_fields` es `Json` sin forma garantizada por TypeScript — un `as CandidacyFields` confía ciegamente. Ante una fila malformada, la opción seguía siendo mostrar el portal público (no romperlo), pero pedir DE MÁS es más seguro que pedir de menos — un campo que aparece de más es una molestia, un campo que debería pedirse y no aparece es un hueco de datos silencioso.

---

## Tooltips del menú flotante (Fase 18) — MÁXIMA PRIORIDAD

1. **[2026-09-01] BUG REAL: un tooltip `absolute` sin `z-index` propio puede quedar tapado por un elemento hermano opaco que sí tiene su propio contexto de apilamiento — incluso sin que ninguno declare `z-index` explícito, el orden del DOM decide, y un vecino "activo" puede pintar encima.**
   El indicador del ítem activo del menú flotante (`bg-background`, opaco) y el tooltip nuevo de un ítem vecino podían superponerse visualmente (tooltips más anchos que su propio botón, gap chico entre ítems) — sin `z-index`, gana quien esté después en el DOM, no necesariamente el tooltip. Corregido con `z-10` explícito en el tooltip. Do instead: cualquier tooltip/popover `absolute` que pueda superponerse con un elemento hermano opaco necesita `z-index` explícito, no asumir que "está encima en el árbol visual" alcanza.

2. **[2026-09-01] No se pudo probar en navegador — limitación ya documentada del sandbox, no un bug de la app.** El menú flotante vive dentro del layout autenticado (requiere `requireProfile()` con datos reales de Supabase) y este entorno no tiene salida de red hacia `*.supabase.co` (ver la entrada de Fase 17/entorno de desarrollo remoto). Verificado por inspección de código + `typecheck`/`lint`/`build`, no por interacción real en un navegador — pendiente de confirmación visual del usuario o en producción (Vercel sí tiene salida a internet real).

---

## Creación de vacante basada en plantilla (Fase 18, 7/7) — MÁXIMA PRIORIDAD

1. **[2026-09-01] BUG REAL DE TYPO, encontrado por revisión propia antes de que llegara a review: una variable con caracteres corruptos (cirílico/CJK mezclados en el mismo nombre, dos variantes distintas) compiló porque JS/TS no valida que un identificador "se vea bien", solo que sea consistente.**
   `sync-stages-from-pipeline.ts` tenía `source櫲PipelineId` en la declaración y `sourceпPipelineId` en el uso — dos identificadores DISTINTOS pero visualmente casi idénticos, típico de un artefacto de generación/autocompletado. TypeScript no lo marcó como error de sintaxis inmediatamente reconocible en el diff porque cada uno de los dos nombres corruptos SÍ era válido como identificador aislado. Do instead: después de escribir cualquier archivo con contenido generado de una sola pasada larga, correr `grep -nP "[^\x00-\x7F]"` sobre el archivo y revisar cada match a mano — no asumir que un identificador "raro" se habría marcado solo.

2. **[2026-09-01] BUG REAL: un input de texto dentro de un `<form>` dispara el envío IMPLÍCITO de ese form al presionar Enter — incluso si el botón "propio" del widget es `type="button"` y nunca se toca.**
   `EmploymentReasonSelect` vive dentro del `<form>` de "Crear vacante" (no puede tener su propio `<form>`, HTML no permite anidarlos). El input de "nuevo motivo" no tenía `onKeyDown`, así que Enter usaba el ÚNICO botón `type="submit"` real del DOM — el de crear la vacante, no el de agregar el motivo. Do instead: cualquier `<input type="text">` dentro de un `<form>` ajeno (un widget que vive dentro de un form más grande, sin ser su propio form) necesita `onKeyDown` que intercepte Enter (`preventDefault()` + la acción propia del widget) — no asumir que un botón `type="button"` cercano alcanza para evitar el envío implícito.

3. **[2026-09-01] Patrón nuevo: `<ActionButton>` fuera de un `<form>` (o dentro de uno ajeno) sigue funcionando pasándole `pending` explícito — no hace falta que viva dentro de SU PROPIO `<form action={...}>` para tener el spinner/disabled consistente.**
   `pending ?? formStatus.pending` en `action-button.tsx`: si se pasa `pending={isPending}` (de un `useTransition` propio), gana sobre el `useFormStatus()` ambiente del form que lo rodee (que ni siquiera es el que le importa a este botón). Do instead: cuando un botón que muta datos no puede vivir en su propio `<form>` (widget anidado dentro de un form más grande), usar `<ActionButton type="button" pending={isPendingPropio}>` en vez de inventar un botón crudo con estado manual — sigue siendo la regla no negociable, solo cambia de dónde sale el estado de carga.

---

## Wizard de plantillas — pasos 5-6, cierre (Fase 18, 6/7) — MÁXIMA PRIORIDAD

1. **[2026-09-01] BUG REAL, el más sutil de la sesión: un UPDATE que cambia si el propio actor va a seguir cumpliendo la política de SELECT de esa misma fila no puede confiar en el RETURNING de ese UPDATE para saber si "se guardó".**
   `updateTemplateStep5` dejaba activar `is_confidential` a cualquier admin+ (la política de escritura no mira quién es `created_by`), pero la política de lectura sí — un admin que no es el creador, al activar el switch, deja de cumplir esa política desde el mismo `UPDATE`. El código pedía `.select("id")` sobre ese UPDATE para confirmar éxito: como el RETURNING se filtra por la política de SELECT DESPUÉS de escribir, volvía vacío — `data.length === 0` se leía como "no se guardó", cuando en realidad sí se había guardado. El siguiente paso (redirigir al paso 6) además le daba un 404 real, sin ninguna pista de que su cambio sí había funcionado.
   Do instead: cuando un UPDATE puede cambiar si el actor sigue teniendo SELECT sobre la fila que acaba de tocar, la confirmación de éxito no puede depender del RETURNING de ese mismo UPDATE — confirmar existencia con un SELECT aparte ANTES de escribir, y decidir el resultado del `UPDATE` solo por su `error`, no por si el actor todavía puede leer la fila después.

2. **[2026-09-01] Decisión, consecuencia del bug de arriba: si el guardado del paso 5 deja al actor sin poder ver su propia plantilla, no se lo manda al paso siguiente — se lo manda al listado con un mensaje que explica por qué.**
   Mandarlo al paso 6 de todos modos le habría dado un 404 sin contexto (ya no cumple `can_view_job_template`). En vez de "arreglar" el síntoma escondiendo el 404, se cambia el destino del redirect según si el actor va a poder seguir viendo la fila o no — la excepción a la regla "todo paso avanza al siguiente" está documentada en el propio código, no es un caso suelto.

---

## Wizard de plantillas — paso 4 "Etapas" (Fase 18, 5/7) — MÁXIMA PRIORIDAD

1. **[2026-09-01] `job_template_stages` nació en la 1/7 con un enum propio (`kind`) que resultó redundante en cuanto se llegó a construir el paso que la usa — reemplazado por el `job_stage_type` que ya usan `pipeline_template_stages`/`job_stages` antes de que nadie hubiera guardado una fila.**
   Se diseñó pensando solo en la UX del wizard (qué posiciones quedan fijas), sin considerar que esta tabla eventualmente se materializa en `job_stages` — que sí necesita el tipo semántico real (`postulado`/`preseleccion`/`entrevista`/`oferta`/`contratado`/`descartado`) para que el resto de la app (filtros de candidatos, kanban) la entienda. Corregido a tiempo porque la tabla seguía vacía (nadie había usado el paso 4 todavía) — sin backfill necesario.
   Do instead: antes de diseñar el esquema de una tabla nueva "solo para la UI de este paso", preguntar si esos datos eventualmente alimentan o se materializan en OTRA tabla que ya tiene su propio tipo/enum establecido — si sí, reusar ese enum desde el principio en vez de inventar uno paralelo que después hay que reconciliar.

2. **[RESUELTO, ver la sección de arriba] Decisión original: "Guardar este set como reutilizable" se recortó de este paso mientras la pestaña Pipelines siguiera existiendo.**
   Ya no aplica — el checkbox se construyó y la pestaña Pipelines se quitó en la misma entrega que cierra esta fase. Se deja el ítem para el historial, no como pendiente real.

---

## Wizard de plantillas — paso 3 "Preguntas" (Fase 18, 4/7) — MÁXIMA PRIORIDAD

1. **[2026-09-01] BUG REAL, encontrado por 2 agentes de `/code-review` independientes con el mismo hallazgo: cambiar el `<select>` de tipo de una pregunta sin limpiar su lista de opciones asociada deja filas huérfanas permanentes.**
   Al pasar una pregunta de "Opción múltiple" a "Abierta" en `QuestionListEditor`, el `onChange` solo parcheaba `type`, no `options` — el bloque de opciones deja de RENDERIZARSE (gateado a `type === "multiple_choice"`) pero sigue vivo en el estado de React, y el input oculto las sigue serializando en cada submit. El servidor las insertaba igual (sin filtro por tipo) — el usuario nunca puede volver a verlas ni borrarlas desde la UI una vez ocurre.
   Do instead: en cualquier editor de lista anidada donde un campo "tipo" decide si un sub-campo aplica o no (acá: `type` decide si `options` tiene sentido), el `onChange` de ese campo tipo tiene que limpiar el sub-campo explícitamente, Y la Server Action tiene que filtrar por ese mismo tipo antes de escribir — las dos capas, no solo una (el cliente puede tener el mismo bug de nuevo mañana).

2. **[2026-09-01] Decisión de arquitectura: los `id` de un INSERT en lote que necesita después un segundo INSERT dependiente (preguntas → opciones) se generan en el cliente/servidor de la app con `crypto.randomUUID()` antes de insertar, nunca se leen del `RETURNING`.**
   Postgres no garantiza que las filas de un `RETURNING` de un `INSERT` multi-fila vuelvan en el mismo orden que los valores insertados — emparejar `insertedRows[i].id` con el índice `i` del array original es una apuesta, no una garantía. Generar los `id` de antemano (`crypto.randomUUID()`, disponible como global en el runtime de Node de este proyecto sin import) elimina el problema por completo. Do instead: cualquier INSERT en lote cuyo resultado alimenta un segundo INSERT relacionado (padre-hijo) genera los ids de antemano, no confía en el orden de vuelta del primero.

---

## Wizard de plantillas — pasos 1-2 (Fase 18, 2/7 y 3/7) — MÁXIMA PRIORIDAD

3. **[2026-09-01] Toda Server Action nueva que muta y redirige necesita `revalidatePath` del listado y de cualquier página propia a la que se pueda volver — se me olvidó en las 3 acciones del wizard, encontrado en `/code-review` antes de commitear.**
   `createTemplateDraftStep1`/`updateTemplateStep1`/`updateTemplateStep2` redirigían sin revalidar nada, rompiendo la convención que sigue cada Server Action de este proyecto (`job-templates/actions.ts`, `departments/actions.ts`, `jobs/actions.ts`, todas la llaman). Do instead: al escribir una Server Action nueva que hace `redirect()` tras mutar, copiar el bloque `revalidatePath(...)` de la acción hermana más parecida ANTES de considerarla terminada — no es opcional solo porque el destino "parece" dinámico.

## Wizard de plantillas — paso 1 "Detalles" (Fase 18, 2/7) — MÁXIMA PRIORIDAD

1. **[2026-09-01] BUG REAL DE REGRESIÓN: agregar una columna `status` con `DEFAULT 'draft'` a una tabla que ya tenía un flujo de creación existente puede volver invisibles filas que antes eran normales, sin tocar ese flujo para nada.**
   `job_templates.status` se agregó en la 1/7 pensando en el wizard nuevo (progresivo). `createJobTemplate()` (Fase 15, diálogo de un solo paso, nunca supo de `status`) seguía insertando bien — pero cada plantilla nueva nacía en `'draft'` por el default, y el nuevo `getPublishedJobTemplates()` (filtra `published`) las excluía todas del selector de "Solicitar vacante". Se encontró en `/code-review` antes de commitear, no en producción.
   Do instead: cuando una migración agrega una columna con estado (`status`, `draft/published`, `activo/inactivo`) a una tabla con un flujo de creación YA EXISTENTE, revisar ese flujo explícitamente — ¿debería seguir produciendo el equivalente de "listo para usar" de siempre, o heredar el nuevo estado por defecto? No asumir que un default de columna es inocuo solo porque no rompe el `INSERT` en sí.

2. **[2026-09-01] Entorno: un archivo que Bash puede leer bajo `~/.claude/projects/.../tool-results/` puede ser invisible para el tool de PowerShell en la misma sesión (`Test-Path` da `False`), sin patrón claro de cuándo pasa.**
   Encontrado al intentar extraer el resultado de `generate_typescript_types` (guardado como archivo grande fuera del contexto) — Bash lo leía sin problema (`head -c` funcionaba), PowerShell no lo encontraba ni con la ruta exacta copiada de `Get-ChildItem`. Do instead: si PowerShell no encuentra un archivo bajo `tool-results` que Bash sí ve, copiarlo primero al working directory del proyecto con Bash (`cp`) y operar sobre la copia — no perder tiempo reintentando la ruta original.

---

## Esquema del wizard de plantillas de vacante (Fase 18, 1/7) — MÁXIMA PRIORIDAD

Origen: rediseño grande pedido por el usuario (wizard de plantillas de vacante paso a paso, candidatura dinámica, preguntas con precalificación, confidencialidad). Esta entrega es solo esquema y RLS — las fases 2-7 construyen la UI encima, cada una con su propio plan.

1. **[2026-09-01] BUG DE SEGURIDAD REAL: una política `FOR ALL` también gobierna `SELECT`, y se combina en OR con la política de lectura — puede dejar ver una fila que la política de SELECT explícitamente esconde.**
   `job_templates_write_admin` (Fase 15, ya existía) es `FOR ALL`. Al agregar `is_confidential` y una `job_templates_select` más estricta (`can_view_job_template`, esconde una plantilla confidencial de quien no es su creador), la plantilla confidencial SEGUÍA siendo visible para cualquier admin+ de la organización — la política de escritura, al cubrir también SELECT, la dejaba pasar sin pasar por la función nueva. Se detectó simulando el rol real (insertar una confidencial de otro creador, `select count(*)` como un admin distinto) — leer el SQL de la política no lo hubiera mostrado, hacía falta correrlo. Corregido partiendo `job_templates_write_admin` (y las 3 políticas de escritura de sus hijas nuevas) en `INSERT`/`UPDATE`/`DELETE` por separado, ninguna declarada `FOR ALL`.
   Do instead: en cuanto una tabla tenga una política de SELECT con una condición más estricta que "cualquiera del rol X" (confidencialidad, visibilidad parcial), auditar TODAS las demás políticas de esa tabla — si alguna es `FOR ALL`, hay que partirla o la condición estricta queda de adorno. No alcanza con revisar la política que se acaba de escribir.

2. **[2026-09-01] `auth.uid()` como `DEFAULT` de columna no sirve en el momento de una migración (sin contexto de request, evalúa `null`), pero SÍ sirve para cada INSERT real de la app de ahí en adelante.**
   `job_templates.created_by` se agregó `NOT NULL` sin default, con un backfill (`UPDATE ... SET created_by = <super_admin de la org>`) para las filas ya existentes, y RECIÉN DESPUÉS `ALTER COLUMN created_by SET DEFAULT auth.uid()`. Sin ese paso separado, `createJobTemplate()` (Fase 15, nunca mandó `created_by`) hubiera roto en el primer POST real después de esta migración — confirmado porque `typecheck` lo señaló de inmediato (el tipo `Insert` generado exige la columna cuando no ve un default en `information_schema`).
   Do instead: cuando una columna `NOT NULL` nueva necesita quedar poblada por el actor real (no un valor fijo), backfill con un `UPDATE` explícito primero, `SET NOT NULL` después, y recién ahí agregar `DEFAULT auth.uid()` — hacerlo en un solo paso (columna con default volátil desde el `ADD COLUMN`) rompe el backfill de las filas existentes.

3. **[2026-09-01] Decisión: `job_questions`/`job_question_options` (copia por vacante) sí quedaron con política de escritura `FOR ALL`, a diferencia de sus pares de plantilla — verificado que es seguro, no un descuido.**
   `private.can_access_job()` empieza con `is_admin_or_above() OR ...` — un admin+ ya tiene acceso incondicional a toda vacante de su organización, así que una política `FOR ALL` no le regala ningún `SELECT` que `can_access_job` no le diera igual (a diferencia de `job_templates`, que sí tiene una condición de confidencialidad que un admin+ no cumple automáticamente). Confirmado leyendo `prosrc` de `can_access_job` antes de decidir, no asumido por analogía.

4. **[2026-09-01] El JWT de prueba en simulación de rol necesita `app_metadata.app_role`, no `app_metadata.role` — mismo error de sintaxis ya anotado en Fase 13, repetido de nuevo antes de recordarlo.**
   Costó dos intentos fallidos (parecían RLS negando de más) antes de volver a `select prosrc from pg_proc where proname = 'auth_role'` y confirmar el nombre exacto. Do instead: la próxima vez, empezar por ahí, no por adivinar.

---

## Fusión de plantilla de vacante + conexión a pipeline/competencias (Fase 17) — MÁXIMA PRIORIDAD

Origen: comparación contra un documento de referencia del sistema real (RH-Suite) que el usuario pidió revisar. El documento mostró que "elegir plantilla" en el sistema real FUSIONA campos (no pisa lo ya escrito) y que la plantilla trae su propio pipeline + rúbrica de evaluación — ninguna de las dos cosas existía en la Fase 15 original.

1. **[2026-09-01] BUG DE SEGURIDAD REAL, el más serio de la sesión: el primer diseño de "aplicar plantilla" mandaba el CONTENIDO de la rúbrica (nombre/peso de cada competencia) del cliente al servidor, y `createJob` lo insertaba tal cual usando el cliente admin (que bypasea RLS).**
   `job_competencies` exige `admin+` para escribir (`job_competencies_write_admin`) — pero `createJob` deja crear vacantes a cualquier `gestor`. La primera versión de este fix insertaba las competencias que llegaban en un campo oculto del formulario usando `createAdminClient()` (mismo motivo que `materializeJobStages`: un gestor no tiene SELECT sobre las tablas admin-only que arman el pipeline). El problema: a diferencia de `materializeJobStages` (que solo recibe un ID de plantilla del cliente y vuelve a consultar el CONTENIDO real en el servidor), esta primera versión insertaba el contenido que el cliente mandó, sin volver a verificarlo contra nada. Un gestor podía fabricar un POST directo a `createJob` con nombres/pesos de competencia inventados y se insertaban igual, evitando por completo el gate admin+ que protege esa tabla en cualquier otro flujo. Corregido: el cliente solo manda `template_id` (una referencia); `createJob` vuelve a leer `job_templates.competencies` desde la base con el cliente de SESIÓN (no el admin — `job_templates_select` ya permite leer a cualquier miembro de la organización) antes de decidir qué insertar. Do instead: cuando el cliente admin (`createAdminClient()`) bypasea RLS para que un rol sin acceso directo pueda completar una acción legítima, **el cliente nunca debe mandar el contenido que se va a escribir — solo un id que el servidor vuelve a resolver.** Si el servidor confía en el contenido en vez de en el id, el bypass de RLS se convierte en un bypass de la regla de negocio completa (aquí, "solo admin+ decide la rúbrica de evaluación").

2. **[2026-09-01] Un formulario no controlado (`defaultValue`) no puede "fusionar" datos nuevos vía props — la fusión real necesita manipular el DOM a mano.**
   El primer intento de "fusionar en vez de reemplazar" seguía usando el mecanismo de `key`+remount de Fase 15 (que por diseño REEMPLAZA todo el formulario). Eso no es fusión, es "reemplazar con un candado si ya hay algo" — no cumple lo que pedía el documento de referencia (RH-Suite solo llena los campos VACÍOS). La solución real: `JobForm` expone su `<form>` vía `ref` (con `forwardRef`), y quien elige la plantilla (`NuevaVacanteForm`) recorre `form.elements.namedItem(nombre)` campo por campo, escribiendo el valor SOLO si el campo actual está vacío (`fillIfEmpty`). Nada de `key`, nada de remount — el mismo `<form>` sigue vivo, solo se le tocan los campos que el usuario no había tocado.

3. **[2026-09-01] Reabrir "Nueva plantilla" tras crear una mostraba la rúbrica de la plantilla recién creada — `formRef.current.reset()` (nativo) no toca estado de React.**
   `CompetencyListEditor` guarda sus filas en `useState`, no en `defaultValue` de inputs — un `reset()` nativo del formulario no lo alcanza. Se corrigió exponiendo un `ref` imperativo (`useImperativeHandle`) con un método `clear()`, llamado junto al `reset()` nativo. Do instead: cualquier editor de lista tipo `PipelineStagesEditor`/`CompetencyListEditor` (estado de React serializado a un input oculto) necesita su PROPIO mecanismo de limpieza — el `reset()` de un `<form>` nativo solo alcanza inputs/textareas/selects no controlados.

4. **[2026-09-01] `react-hooks/set-state-in-effect` bloquea `setState` dentro de un `useEffect` incluso llamado a través de un ref imperativo indirecto si el linter lo puede rastrear — pero SÍ permite llamar un método imperativo expuesto por OTRO componente (`ref.current?.clear()`), porque no puede ver dentro de él.**
   Confirma el mismo patrón ya documentado en Fase 12 (`message-form.tsx`): cuando ESLint bloquea un `setState` directo dentro de un efecto, la salida no es "sacar la lógica del efecto" — es mover el `setState` a un componente hijo y exponerlo como un método imperativo (`useImperativeHandle`) en vez de una prop de estado (`key`).

---

## Configurador de bolsa pública (Fase 16) — MÁXIMA PRIORIDAD

1. **[2026-09-01] Alcance recortado a propósito: 2 columnas nuevas en `organizations` (`careers_headline`, `careers_intro`) reusando el formulario de Marca ya existente, no una página ni tabla nueva.**
   El ítem del roadmap decía "configurador de bolsa pública (editor de contenido multi-página)" — sonaba a mucho más de lo que en realidad hace falta para una demo. Lo real: el portal público (`/empleos`) solo necesitaba un título y un texto de bienvenida configurables; no hace falta una tabla nueva, RLS nueva, ni una página de configuración nueva — son 2 campos más en la fila de `organizations` que ya existe, guardados por la misma acción que ya guarda logo/color/nombre. Do instead: antes de diseñar una tabla/página nueva para un ítem de roadmap que "suena grande", preguntar qué tan grande es el contenido real — a veces son 2 columnas en una tabla que ya existe.

2. **[2026-09-01] Decisión de permiso: el contenido de la bolsa pública quedó gateado a `super_admin` (mismo nivel que logo/color), no a `admin` como el resto de la configuración de reclutamiento — decisión deliberada, no un descuido.**
   `admin` (RH) sería el dueño natural de este copy, pero la política RLS de `UPDATE` en `organizations` (`organizations_update_super_admin`) es a nivel de FILA, no de columna — Postgres RLS no puede decir "admin puede tocar `careers_headline` pero no `accent_color`" sobre la misma fila sin un trigger o una tabla aparte. Bajar el gate a `admin+` en la acción compartida (`updateBranding`) le daría a cualquier `admin` la capacidad de cambiar también el logo, el color de acento y el nombre de la plataforma — una escalación de permiso real. Se dejó en `super_admin` (más estricto, consistente con Marca) en vez de resolver esto ahora. Si se necesita de verdad que `admin` edite el copy de la bolsa sin tocar la identidad visual, la solución correcta es sacar `careers_headline`/`careers_intro` a una tabla aparte con su propia política — no relajar la política de `organizations`.

3. **[2026-09-01] BUG REAL: `?? null` no captura un valor de solo espacios porque `optionalText()` solo convierte a `undefined` el valor CRUDO antes de recortar, no el resultado ya recortado.**
   `optionalText("   ").safeParse(...)` → el preprocess ve `"   "` (no es `""` ni `null`), lo deja pasar; luego el `.trim()` interno del schema lo reduce a `""` — el resultado final en `parsed.data` es `""`, no `undefined`. `"" ?? null` da `""`, no `null`. Corregido con `|| null` en vez de `?? null` (trata `""` igual que `null`/`undefined`). Do instead: cuando se necesite "vacío o solo espacios → null" después de un `optionalText()`, usar `|| null`, no `?? null` — el operador `??` solo mira nullish, no falsy, y un string recortado a `""` no es nullish.

---

## Motor de plantillas de vacante (Fase 15) — MÁXIMA PRIORIDAD

1. **[2026-09-01] BUG REAL (recurrente, 3ª vez que aparece en la sesión): un diálogo de editar con inputs no controlados (`defaultValue`) no se entera cuando sus props cambian — solo aplica el valor al montar.**
   `JobTemplateDialog` no se remontaba entre aperturas: tras guardar una edición y reabrir "Editar" sobre la MISMA fila sin recargar la página, los campos mostraban el valor de ANTES de guardar, no el recién guardado. Mismo patrón ya sospechado en `DepartmentDialog`/`MessageTemplateDialog` (no confirmado ahí, pero comparten la exacta misma estructura — probablemente el mismo bug). Corregido acá con `key={template.updated_at}` en el uso del diálogo — cambia cada vez que la fila realmente cambió, forzando un remount con datos frescos. Do instead: cualquier diálogo de "editar" con inputs `defaultValue` necesita una `key` atada a algo que cambie cuando el dato subyacente cambia (`updated_at` es ideal, ya viene gratis en casi toda tabla) — no asumir que basta con que el diálogo cierre y vuelva a abrir.

2. **[2026-09-01] Bug del mismo síntoma, causa distinta: el formulario de CREAR (sin `template`, sin id que cambie entre aperturas) no se limpiaba solo — necesitó `formRef.current?.reset()`, no una `key`.**
   Una `key` no ayuda acá porque no hay ningún valor que cambie entre "crear la primera plantilla" y "crear la segunda" — el fix es imperativo (`reset()` del form nativo), no declarativo. Do instead: distinguir el síntoma "reabrir muestra datos viejos" en dos causas — edición (usar `key` atada a un campo que cambia) vs. creación (usar `formRef.reset()`), no aplicar la misma solución a ambas.

3. **[2026-09-01] Reuso: `JobTemplateSchema` se derivó de `JobFormSchema` con `.pick()` en vez de retipar los mismos 5 campos — requirió separar `JobBaseSchema` (sin `.refine()`) de `JobFormSchema` (con `.refine()`) en `src/lib/jobs/schema.ts`, porque Zod v4 no permite `.pick()` sobre un schema que ya tiene un refinamiento encima.**
   `z.object({...}).refine(...).pick({...})` lanza `.pick() cannot be used on object schemas containing refinements` en tiempo de ejecución, no es un error de tipos — se descubre corriendo el código, no compilando. Do instead: si un schema necesita `.refine()` Y otro schema necesita reusar un subconjunto de sus campos con `.pick()`, separar el objeto base (sin refine) del schema final (`base.refine(...)`) desde el principio — no agregar el refine directo al `z.object()` inicial si ya se sabe que otro lugar va a necesitar sus campos sueltos.

4. **[2026-09-01] Reuso: `LabelSelect` extraído a `src/components/ui/` tras la 2ª aparición del mismo `Object.entries(WORK_MODE_LABEL).map(...)` (job-form.tsx ya lo tenía, job-template-dialog.tsx lo iba a repetir).**
   Distinto del criterio "esperar a la 3ª copia" de Fases 12/14 — acá se extrajo en la 2ª porque dos revisores independientes convergieron en el mismo hallazgo con el mismo fix sugerido, señal más fuerte que "se parece a algo" a secas.

---

## Segmentos y filtros de candidatos (Fase 14) — MÁXIMA PRIORIDAD

1. **[2026-09-01] BUG REAL, el más serio de esta fase: forzar `!inner` sobre un embed de Supabase para poder filtrar por su columna reintrodujo un bug ya documentado y corregido en Fase 5 — pero esta vez borraba la fila COMPLETA en silencio, no solo lanzaba un error de acceso nulo.**
   `job_stages`/`jobs` tienen RLS más estricta que `applications` (un colaborador sigue viendo la postulación de su referido aunque la vacante ya no le sea visible). `job_stages!inner(name, type)` sin condición — puesto ahí solo para poder hacer `.eq("job_stages.type", ...)` — hace que PostgREST exija una fila de `job_stages` unible para devolver la fila padre, así que cualquier candidato cuya etapa dejó de ser visible desaparecía por completo de `/candidatos`, sin filtro de etapa activo siquiera. Corregido quitando el `!inner` (vuelve a ser `job_stages(name, type)`, nullable) y filtrando por tipo de etapa en JS después de traer las filas. Do instead: cuando se necesite filtrar por una columna de un embed, preguntar primero si la tabla embebida tiene RLS más estricta que la tabla principal — si sí, **nunca** usar `!inner` sin condición; o se filtra en JS después de un left join normal, o se hace `!inner` solo cuando ese filtro específico está realmente activo.

2. **[2026-09-01] BUG REAL: validar un valor de la URL con `valor in objetoDeEtiquetas` es vulnerable a la cadena de prototipos de JavaScript.**
   `"constructor" in STAGE_TYPE_LABEL` da `true` (existe en `Object.prototype`), aunque `STAGE_TYPE_LABEL` nunca declaró esa clave — `/candidatos?stage_type=constructor` pasaba la validación y el string `"constructor"` llegaba como literal de enum a Postgres. Corregido reemplazando el chequeo `in` por un parseo real con Zod (`CandidateFiltersSchema.safeParse`), que ya existía para el formulario de guardar segmento — una sola fuente de verdad para ambos casos. Do instead: nunca validar un valor externo contra las claves de un objeto plano con el operador `in` — usar `Object.prototype.hasOwnProperty.call(obj, key)`, un `Set`, o (mejor, si ya existe) el schema de Zod correspondiente.

3. **[2026-09-01] Reuso perdido: `STAGE_TYPE_LABEL` y la lista de 6 valores de `job_stage_type` ya existían en `src/lib/pipeline-templates/schema.ts` (Fase 9) — se reescribieron desde cero sin buscar primero si ya existían.**
   Corregido reexportando `STAGE_TYPE_LABEL` desde `pipeline-templates/schema.ts` en `src/lib/candidates/labels.ts`, y reusando `StageSchema.shape.type` (el enum de Zod ya construido) en vez de una lista literal nueva. Do instead: antes de escribir un mapa de etiquetas o un enum de Zod para un valor de la base de datos, grep del nombre del enum (`job_stage_type`, `application_status`, etc.) en todo `src/lib/` — es muy probable que una fase anterior ya lo haya necesitado.

4. **[2026-09-01] Decisión: sin paginación real todavía — `.limit(100)` con un aviso honesto ("mostrando los N más recientes") en vez de fingir que la lista está completa.**
   Un segmento guardado ahora persiste un filtro como vista reusable — antes el límite era un detalle menor de una búsqueda de texto efímera, ahora puede esconder resultados de forma indefinida cada vez que alguien abre ese segmento. Paginación completa es un desarrollo aparte (mismo tipo de decisión que "no bulk actions esta fase", ver abajo); el mínimo honesto es no fingir que 100 es "todos".

5. **[2026-09-01] Alcance recortado a propósito: sin acciones masivas (bulk reject/mover etapa) esta fase.**
   El ítem del roadmap "Segmentos/columnas de Candidatos" incluía acciones masivas como sub-ítem. Se construyó la tabla densa + filtros + segmentos guardados (el núcleo del ítem); acciones masivas queda pendiente, documentado aquí para no perderlo, no implementado.

---

## Entrevistas + Google Calendar (Fase 13) — MÁXIMA PRIORIDAD

1. **[2026-09-01] Decisión: integración con Google Calendar sin OAuth ni API — solo enlaces "TEMPLATE" (`calendar.google.com/calendar/render?...`).**
   Requiere pedir el scope `calendar.events` en el login de Google (hoy solo se pide perfil/email), guardar refresh token, y renovar credenciales — todo eso es configuración manual en Google Cloud Console (mismo tipo de paso que el hook de custom access token o el proveedor de Google en Supabase, ningún agente puede hacerlo por API). Se optó por el enlace "agregar a mi calendario" de un clic: cero credenciales nuevas, funciona igual de bien para una demo, y cada quien agrega el evento a SU PROPIO calendario. Si se necesita sincronización real (auto-invitar, detectar cambios, cancelar desde Calendar), ahí sí hace falta OAuth completo — anotado como alcance futuro, no implementado.

2. **[2026-09-01] BUG REAL: la hora del correo al candidato se formateaba con la zona horaria del SERVIDOR, no la de la organización ni la del candidato — podía contradecir el enlace de Google Calendar del mismo correo.**
   `toLocaleString()` sin `timeZone` explícito, evaluado en un React Email renderizado server-side (dentro de `after()`), usa la zona del proceso Node (típicamente UTC en producción), no la del navegador de quien lo lee. El enlace "TEMPLATE" de Google Calendar sí es correcto siempre (manda el instante en UTC, Google lo convierte en el navegador de quien lo abre) — el texto y el enlace del mismo correo podían decir horas distintas. No existe una columna de zona horaria en `organizations`, así que la corrección no fue "adivinar la zona correcta" sino ser honesto: mostrar la hora en UTC explícito y remitir al enlace para la hora local real. Do instead: cualquier fecha/hora renderizada en un correo (server-side, sin `after()` corriendo en el navegador de nadie) necesita `timeZone` explícito en `toLocaleString`/`Intl.DateTimeFormat` — nunca asumir que el servidor y el destinatario comparten zona horaria.

3. **[2026-09-01] Decisión de nivel de permiso: agendar/cancelar/eliminar una entrevista exige `canDecideApplication` (mismo nivel que rechazar/contratar/mandar mensaje), NO el nivel más permisivo de Tareas — con una excepción de auto-servicio.**
   El primer diseño copió el nivel de autorización de `candidate_tasks` (cualquier colaborador con acceso a la vacante) porque la tabla es RLS-gemela de `candidate_tasks`. Un review encontró el error: agendar dispara un correo al candidato a nombre de la plataforma — mismo tipo de efecto hacia afuera que `sendCandidateMessage`, no el efecto puramente interno de una tarea. Se corrigió para exigir `canDecideApplication` en `scheduleInterview`/`deleteInterview`, con una excepción: `updateInterviewStatus` deja que la persona asignada como `interviewer_id` marque su propia entrevista sin ser approver/owner (mismo auto-servicio que ya permite la política RLS `interviews_update` vía `interviewer_id = auth.uid()`). Do instead: la forma de la tabla (mismo shape RLS que otra tabla) NO determina el nivel de permiso de la Server Action — eso lo decide si la acción tiene un efecto visible hacia el candidato o hacia afuera de la organización, sin importar qué tan parecida sea la tabla a una ya construida.

4. **[2026-09-01] El JWT de prueba en simulación de rol necesita `app_metadata.app_role`, no `app_metadata.role` — error de sintaxis repetido al armar el primer test de esta fase, ya cometido antes en Fase 8-11 pero no anotado hasta ahora.**
   `private.auth_role()` lee `auth.jwt() -> 'app_metadata' ->> 'app_role'` (ver `private.is_admin_or_above()`); un test con `app_metadata: { role: 'admin' }` (sin el prefijo `app_`) falla la política silenciosamente — el INSERT de prueba se rechaza y parece un bug de RLS cuando en realidad es un JWT de prueba mal armado. Do instead: antes de escribir un test de simulación de rol nuevo, confirmar el nombre exacto de la claim corriendo `select pg_get_functiondef(oid) from pg_proc where proname = 'auth_role'` — no asumir el nombre por analogía con `organization_id`.

5. **[2026-09-01] Tercera vez que el mismo preprocesador zod ("cadena vacía → undefined") se copia a mano en un archivo nuevo — recién extraído a `src/lib/zod-helpers.ts` en esta fase.**
   Ya estaba duplicado en `departments/schema.ts` y `api/postular/route.ts` desde antes; esta fase iba a agregar una cuarta copia. Mismo patrón que `ConfigListSkeleton` en Fase 12: la señal real de extraer no es "esto se parece a algo", es "esto YA se duplicó una vez antes de que yo llegara".

---

## Plantillas de mensaje + correo directo al candidato (Fase 12) — MÁXIMA PRIORIDAD

1. **[2026-09-01] `application_event_type` ya tenía el valor `correo_enviado` desde el diseño original del esquema, sin ningún código que lo insertara — confirmado por grep antes de escribir la Server Action.**
   El schema fue diseñado anticipando esta feature (Fase 6 dejó el enum listo) pero nunca se cableó hasta ahora. Do instead: antes de decidir que un enum "no se usa" o está muerto, comprobar con grep si de verdad no hay ningún productor — puede ser una feature futura ya prevista, no basura.

2. **[2026-09-01] El destinatario del correo sale SIEMPRE de la fila (`applications.candidates.email`), nunca de un campo del formulario — variante nueva del patrón IDOR de esta sesión.**
   A diferencia de los 5 casos anteriores (un id de OTRA fila que no se revalida), acá el riesgo es distinto: si el "to" viniera del cliente, cualquiera con acceso de escritura a la acción podría mandar un correo con remitente de esta plataforma a una dirección arbitraria (vector de phishing), no solo leer/escribir datos ajenos. Do instead: en cualquier acción que envía correo a un tercero (no un perfil interno), el destinatario se resuelve siempre server-side desde la fila que la acción ya tiene permiso de leer — jamás se acepta como parámetro, ni siquiera oculto en un campo hidden.

3. **[2026-09-01] Un `<textarea>` manda saltos de línea como `\r\n` en el FormData — `body.split("\n")` sin normalizar deja un `\r` colgando en cada línea salvo la última.**
   Encontrado por revisión línea-por-línea antes de llegar a producción. Do instead: cualquier código que haga `split("\n")` sobre texto que vino de un `<textarea>` (o cualquier input HTML multilínea) debe normalizar con `.replace(/\r\n/g, "\n")` primero — no asumir que el navegador manda `\n` puro.

4. **[2026-09-01] Precedente confirmado (no bug): reusar un permiso "de decisión" (`canDecideApplication`) para una acción nueva (enviar mensaje) puede dar a un `colaborador` con tier `approver`/`owner` una capacidad que la UI no expone a su rol — pero esto ya era así para Contratar/Rechazar/Tareas, no es una regresión nueva.**
   El gate de UI (`profile.role !== "colaborador"`) y el permiso real de servidor (`canDecideApplication`, que sí deja pasar a un colaborador con tier alto en `job_collaborators`) llevan divergiendo desde Fase 5 — es el modelo de acceso fino documentado en AGENTS.md ("el acceso fino se resuelve con `job_collaborators`, no subiendo el rol global"), no un hueco. Do instead: antes de "corregir" una discrepancia UI-vs-servidor en este proyecto, comprobar si YA es el patrón aceptado en pantallas hermanas (Contratar/Rechazar) antes de tratarla como bug nuevo.

5. **[2026-09-01] Tres páginas de configuración con lista simple (`motivos-rechazo`, `pipelines`, ahora `plantillas-mensaje`) habían llegado a tener el mismo `loading.tsx` copiado a mano — extraído a `<ConfigListSkeleton />` recién en la 3ª repetición.**
   Do instead: la regla "tres líneas similares > abstracción prematura" aplica a *código nuevo* que se parece a algo existente — pero si el código NUEVO sería la 3ª copia casi idéntica de algo que YA se duplicó una vez antes, esa es la señal real de extraer, no de aceptar una 3ª duplicación.

---

## Evaluación por competencias (Fase 11) — MÁXIMA PRIORIDAD

1. **[2026-09-01] BUG REAL, encontrado por un agente con acceso directo a Supabase (no solo lectura de código): `UPDATE`/`DELETE` de `application_competency_scores` no revalidaban acceso a la vacante, solo `evaluator_id = auth.uid()`.**
   A diferencia de `SELECT`/`INSERT` (que sí exigen `can_access_job`), un evaluador al que se le quita el acceso (deja de ser `job_collaborator`) podía seguir tocando su calificación vieja. Corregido con una migración que agrega el mismo `EXISTS(...can_access_job...)` a ambas políticas. Verificado con simulación de rol real: se quita el `job_collaborator`, se intenta `UPDATE`, 0 filas afectadas.
   Do instead: cuando una tabla nueva tiene SELECT/INSERT con un chequeo (ej. `can_access_job`) y UPDATE/DELETE con otro más simple (ej. solo "soy el dueño de la fila"), preguntarse explícitamente si ese chequeo más simple debería incluir también el primero — no asumir que "ya es mi fila" es suficiente si el permiso subyacente (acceso a la vacante) pudo cambiar después de crearla.

2. **[2026-09-01] BUG REAL (4ª vez esta sesión, variante nueva): `submitScore` nunca validaba que `competencyId` perteneciera a la MISMA vacante que `applicationId`.**
   A diferencia de las 3 veces anteriores (un id de OTRA fila del mismo tipo, ej. otro perfil), acá son dos ids de tablas DISTINTAS que deben coincidir en un campo compartido (`job_id`) sin que ninguna FK lo obligue — ninguna restricción de base de datos liga `application_competency_scores.application_id` con `.competency_id` a través de un `job_id` común. Do instead: cuando dos columnas de una misma fila referencian tablas distintas que a su vez comparten un campo "padre" (aquí, `job_id`), y no hay una FK compuesta que lo fuerce, la Server Action tiene que leer y comparar ese campo compartido a mano antes de escribir — mismo principio que "un id hijo no prueba pertenencia al padre correcto" (Fase 5), pero entre dos hijos del mismo padre, no un hijo y su padre.

3. **[2026-09-01] BUG REAL, encontrado por línea-por-línea: una `key` de React compartida entre postulaciones distintas puede filtrar estado de un candidato a otro.**
   `CompetencyRow` se keyeaba solo por `competencyId` (pertenece a la VACANTE, no a la postulación) — dos candidatos de la misma vacante comparten esa key. Al navegar de un candidato a otro (misma vacante), React podía reciclar la instancia del componente y su estado local (la calificación en progreso), dejando que se guardara la nota de un candidato sobre otro.
   Do instead: cuando un componente de cliente muestra datos de una entidad (aquí, competencia) que en realidad pertenece a un padre compartido (la vacante) pero se renderiza en el contexto de un hijo específico (la postulación/candidato), la `key` de React tiene que incluir el id del hijo, no solo el de la entidad compartida — aunque la entidad compartida ya tenga su propio id único.

4. **[2026-09-01] Decisión: `position` de `job_competencies` se simplificó a un valor fijo (0), ordenando por `created_at`.**
   El primer intento calculaba `position` con un `COUNT` antes de cada insert — sin constraint de unicidad, esto colisiona de forma determinística después de un borrar+agregar (no hace falta concurrencia para reproducirlo). Como no existe todavía un reordenamiento manual de competencias, no hay ninguna razón para mantener un valor calculado que nadie lee de forma ordenada — se resuelve solo con orden de creación. Si se agrega reordenamiento después, ahí sí vale la pena un `position` real mantenido (con el mismo patrón "reemplazar todo" que `pipeline_templates`).

5. **[2026-09-01] Pendiente, documentado a propósito: el peso (`weight`) de cada competencia se captura y se muestra, pero no se usa todavía para calcular un puntaje global ponderado de la postulación.**
   Hoy cada competencia solo muestra su propio promedio simple entre evaluadores; no existe un "puntaje total" que combine las competencias usando su peso. Es una limitación conocida, no un bug — construirlo bien necesita decidir dónde mostrarlo y qué hacer cuando faltan calificaciones en algunas competencias, y no se improvisó en esta fase.

---

## Tareas del candidato (Fase 10) — MÁXIMA PRIORIDAD

1. **[2026-09-01] Primera tabla nueva desde Fase 2 — `candidate_tasks`, migrada con `apply_migration` sin bloqueo del clasificador de auto-modo.**
   A diferencia del `ALTER TYPE ADD VALUE` bloqueado en Fase 7, un `CREATE TABLE` + RLS completo pasó sin pedir aprobación extra. No hay un patrón claro de qué bloquea el clasificador — no asumir que DDL "grande" se bloquea más que DDL "chico"; cada intento es su propio caso.

2. **[2026-09-01] Verificación de RLS con simulación de rol encontró un falso positivo por mal diseño de la prueba, no un bug real — anotar el error para no repetirlo.**
   Primera prueba: reutilicé el mismo perfil real (el único que existe en esta demo) como `requested_by` de la vacante Y como el "colaborador ajeno" que se probaba — `can_access_job` daba `true` correctamente (sí era el requester), pero yo esperaba `false`. Parecía un hueco de seguridad grave ("cualquiera puede insertar tareas").
   Do instead: para probar "colaborador sin ninguna relación", la vacante de prueba necesita `owner_id`/`requested_by` en `null` explícito (bypasear RLS con el rol default de la conexión SQL para el setup, no con `set role authenticated`) — nunca reusar el único perfil real disponible como "el ajeno" a la vez que como dueño de los datos de prueba.

3. **[2026-09-01] BUG REAL (mismo patrón, 3ª vez esta sesión): `assigned_to` de una tarea no se validaba contra la gente con acceso real a la vacante antes de insertar.**
   El `<select>` del formulario (`task-form.tsx`) ya solo ofrece gente con `can_access_job` (admin+ o colaborador de esa vacante) — la Server Action `addTask` confiaba en eso sin revalidar. Mismo hueco que `job_collaborators` (Fase 8) y `head_profile_id` de departamentos (Fase 9).
   Do instead: **cualquier id que salga de un `<select>` filtrado en el cliente se re-valida server-side, siempre, sin excepción** — a estas alturas esto debería ser un reflejo antes de escribir la Server Action, no un hallazgo de `/code-review`. Ver `isProfileAssignable()` en `src/lib/applications/get-applications.ts`.

4. **[2026-09-01] Las secciones nuevas de una página deben heredar el mismo gate de rol que las secciones vecinas, no asumir "RLS ya lo esconde".**
   La sección de Tareas se agregó sin la misma condición `profile.role !== "colaborador"` que ya protege Contratar/Rechazar en la misma página — un colaborador que ve la postulación solo por haber referido al candidato (no por `can_access_job`) habría visto un formulario que RLS le bloquea en silencio, sin explicación. Do instead: cuando una pantalla ya tiene un gate de visibilidad para un rol, cualquier sección nueva en esa misma pantalla hereda el mismo gate por defecto, salvo razón explícita para no hacerlo.

5. **[2026-09-01] Una consulta nueva y menos probada nunca debe compartir `Promise.all` con datos ya estables de los que depende el resto de la página.**
   `getAssignableProfiles` (recién escrita) se metió en el mismo `Promise.all` que la consulta de `rejection_reasons` (ya estable) — si la nueva fallaba, tumbaba toda la página (CV, notas, calificación, todo). Do instead: envolver la consulta nueva en `.catch(() => valorDeRespaldo)` cuando su fallo no debería impedir que el resto de la página cargue.

---

## Configurador simple: Departamentos, Pipelines, Motivos de rechazo (Fase 9)

1. **[2026-09-01] `email_templates` quedó fuera de Fase 9 a propósito — no se construyó su CRUD.**
   Motivo: nada en el código lee esa tabla todavía (los correos siguen hardcodeados en React Email desde Fase 6). Un CRUD para una tabla que nadie consume es peor que no construirlo — miente sobre tener efecto. Do instead: cuando se aborde, hacerlo junto con wirear `notify()`/`sendEmail()` para leer de ahí, no antes.

2. **[2026-09-01] El patrón "diálogo repetido" cruzó el umbral de 3 a 4 copias — esta vez sí se extrajo `<DialogShell>` (`src/components/ui/dialog-shell.tsx`).**
   Antes: `report-error-dialog.tsx` (Fase 7) y `reject-dialog.tsx` (Fase 5) ya lo tenían flagueado en reviews previos como "no urgente, 2-3 copias". Al aparecer una 4ª (`department-dialog.tsx`), el propio agente de reuso lo marcó como punto de quiebre. Do instead: 2-3 copias del mismo chrome se documentan y se dejan; a la 4ª, extraer — no hay una regla numérica mágica, pero repetirlo un review tras otro sin actuar es la señal real.

3. **[2026-09-01] BUG REAL (mismo patrón de Fase 8): `head_profile_id` de un departamento no se validaba contra la organización del actor antes de escribir.**
   El `<select>` del formulario ya solo lista gente de la org, pero la Server Action confiaba en el valor del cliente. Ver `assertProfileInOrg()` en `src/lib/departments/actions.ts` — mismo helper conceptual que Fase 8 para `job_collaborators`. Do instead: cualquier id que el cliente eligió de un `<select>` filtrado por organización se revalida server-side igual, sin excepción — ya es la segunda vez que aparece este mismo hueco en fases consecutivas.

4. **[2026-09-01] Aceptado, no corregido: `updatePipelineTemplate`/`createPipelineTemplate` borran+reinsertan las etapas sin transacción — ventana real de "plantilla con 0 etapas" si el insert falla justo después del delete.**
   Mismo patrón ya usado en el proyecto para listas anidadas (preguntas/etapas de vacante) — se acepta el mismo trade-off aquí. Corregirlo de verdad requiere una función RPC en Postgres que envuelva ambas operaciones en una transacción real (el cliente de Supabase JS no hace transacciones multi-statement). No se atacó esta sesión — bajo tráfico de escritura en esta pantalla, y cualquier fallo deja un estado detectable (plantilla con 0 etapas, mensaje de error visible), no uno silencioso.

5. **[2026-09-01] Aceptado, no corregido: `setDefaultPipelineTemplate` hace 2 UPDATEs secuenciales (quitar default viejo, poner default nuevo) sin transacción — ventana de "cero plantillas default" si el proceso se interrumpe entre los dos.**
   Mismo motivo que el punto anterior (necesita RPC/transacción real). Si `materializeJobStages()` corre justo en esa ventana, el `.single()` no encuentra fila y el gestor ve "No hay una plantilla de pipeline configurada" — mensaje amigable ya existente, no un crash. Riesgo real bajísimo: un solo admin activo hoy, acción rara.

6. **[2026-09-01] `deletePipelineTemplate` sí se corrigió con compare-and-swap: el chequeo `is_default=false` va en el propio `.eq()` del DELETE, no en un SELECT previo.**
   Mismo patrón que las transiciones de estado de vacantes/postulaciones — evita la carrera "SELECT ve false, otro admin lo marca default, DELETE de todos modos" sin necesitar ninguna migración nueva.

---

## Colaboradores por vacante + Bitácora (Fase 8) — MÁXIMA PRIORIDAD

1. **[2026-09-01] Todo el mecanismo RLS de `job_collaborators` ya existía completo desde Fase 2 — `can_access_job()` ya lo usa en `jobs`/`job_stages`/`applications`. Fase 8 fue 100% UI + capa de app, cero migración.**
   `private.can_access_job(job_id)` = admin+ OR owner/requested_by OR fila en `job_collaborators`. Ya estaba wireado en `jobs_select_internal`, `job_stages_select`, `applications_select/insert/update`. Lo único que faltaba: pantalla para agregar/quitar colaboradores (gateada a admin+ por `job_collaborators_write_admin`).

2. **[2026-09-01] BUG REAL encontrado en `/code-review`: un atajo "sin cambios" antes del chequeo de permiso deja pasar sin autorizar.**
   `moveApplicationStage` tenía `if (fromStageId === toStageId) return {success}` ANTES de validar `canDecideApplication`. No mutaba nada, pero el invariante "toda la función valida permiso" se rompía por ese único camino.
   Do instead: el chequeo de permiso/autorización va SIEMPRE antes de cualquier atajo de "no-op", nunca después — un atajo de conveniencia es fácil de escribir arriba del todo sin pensar que también hay que autorizarlo.

3. **[2026-09-01] BUG REAL (IDOR), encontrado en `/code-review`: agregar un colaborador no validaba que la persona elegida fuera de la misma organización.**
   El `<select>` del panel ya solo lista gente de la org, pero la Server Action confiaba en el `profile_id` que llegara en el FormData sin comparar organización — el cliente nunca es fuente de verdad, ni siquiera cuando la UI ya filtra.
   Do instead: antes de cualquier INSERT con un id que el cliente eligió de un `<select>`, revalidar server-side que esa fila (aquí, el perfil) pertenece a la misma organización que el actor — el mismo patrón que "un id hijo no prueba pertenencia al padre" de Fase 5.

4. **[2026-09-01] RESUELTO (con permiso explícito del usuario): los niveles de `job_collaborators.permission` ahora se hacen cumplir también en Postgres, no solo en la Server Action.**
   RLS (`can_access_job`) sigue sin distinguir nivel — a propósito, sigue gobernando visibilidad. Lo nuevo es un **trigger** `enforce_application_permission_tiers` (`BEFORE UPDATE` en `applications`) que llama a `private.can_decide_application(job_id)`/`private.can_rate_application(job_id)` — espejo exacto (mismo `auth_role() <> 'colaborador' OR EXISTS(...)`) de `canDecideApplication`/`canRateApplication` en `src/lib/applications/permissions.ts`. Si cambian los umbrales en TypeScript, hay que replicar el cambio en las dos funciones SQL o quedan desincronizadas — no hay una sola fuente de verdad todavía (aceptado por ahora, es demo).
   Verificado con simulación real de rol (`set_config('request.jwt.claims',...)` + `set role authenticated`, transacción con rollback, patrón ya documentado arriba): viewer bloqueado en decidir Y calificar, interviewer puede calificar pero no decidir, approver puede ambas — los 3 casos junto con el trigger disparando de verdad (no solo la función aislada).
   Do instead (si se toca de nuevo): correr la misma simulación de rol antes de dar por buena cualquier política/trigger nuevo — no alcanza con leer el SQL.

5. **[2026-09-01] `audit_log` tiene el mismo hueco de organización que `error_reports` (Fase 7) — mismo mitigante.**
   `audit_log_select_super_admin` es solo `is_super_admin()`, sin `organization_id`. `getAuditLog()` filtra en la app. Ver el ítem de Fase 7/Supabase-RLS arriba — es el mismo patrón repetido, no una fuga nueva.

---

## Demo genérica — sin marca real (2026-09-01)

Por indicación del usuario, el repo y los datos de demo NO deben identificar a
ninguna empresa real.

- **Nombre de producto**: `organizations.platform_name = 'Atrio'` (ya usado en
  los mockups de `design/*.dc.html` — solo faltaba escribirlo en la fila real).
  `organizations.name = 'Mi Empresa'` (genérico, sin cambios). `accent_color`
  y `allowed_email_domain` ya eran genéricos/`null`.
- **Logo**: no se sube ningún archivo. El fallback ya existente (cuadro con
  borde + primera letra de `platform_name`, en `login/page.tsx`,
  `app-header.tsx`) hace de "logo genérico" con cero assets nuevos — no
  inventar un logo de imagen, ese fallback YA es el logo.
- Se borraron `public/logo-blanca.png`/`logo-negro.png` — eran el logo real de
  un cliente (Ferco Cerámica), commiteados sin uso en el código (`grep` no
  encontró ningún import). **Siguen en el historial de git** de commits
  anteriores a esta limpieza — borrar eso de verdad requiere reescribir
  historia (`git filter-repo`/BFG + force-push), una operación destructiva que
  no se hizo sin pedirla explícita.
- Se cambió `es-GT`/"Guatemala"/"Centroamérica" por `es`/genérico en 4 sitios
  de formateo de fecha y 2 comentarios (`today-label.tsx`, `greeting.tsx`,
  `application-timeline.tsx`, `note-list.tsx`, `configuracion/errores/page.tsx`)
  — no había ninguna dependencia real de esa configuración regional, solo texto
  de ejemplo/locale hardcodeado.
- `docs/database.md`/napkin mencionan `V1-motoslam` como nombre del proyecto de
  Supabase — es un codename interno de OTRO proyecto reutilizado, no tiene
  relación con ninguna empresa real; no hace falta cambiarlo.
- El repositorio de GitHub ya se renombró a `demo-ats` (antes `Ferco-compen`) —
  hecho fuera de esta sesión, confirmado al hacer push.
- No tocado sin permiso explícito: `context-ats-reclutamiento.md` (fuera de
  este repo, en el directorio padre, describe un sistema legado distinto).

---

## Reglas de Curación
- Re-priorizar en cada lectura. Máximo 10 ítems por categoría.
- Es bitácora de registro: no solo trampas de sintaxis, también decisiones no obvias y errores reales con su corrección. Incluir fecha + "Do instead".
- **Leer ANTES de tocar código.**

---

## Límite del entorno de desarrollo remoto (no es un bug)

1. **[2026-08-31] `npm run dev` en este sandbox NO puede llamar a `*.supabase.co` directo — solo el MCP de Supabase tiene canal permitido.**
   Síntoma: cualquier página que dependa de datos de Supabase (branding, sesión) los recibe como `null` al probar con curl/Playwright contra el dev server local, aunque el código y la política RLS estén correctos (verificado por separado con SQL directo vía MCP). El error real es `"Host not in allowlist: <ref>.supabase.co"`.
   Do instead: verificar la lógica por inspección + typecheck/build + SQL directo contra la base (vía MCP), no por curl/Playwright al dev server para nada que dependa de red hacia Supabase. En producción (Vercel) esto no aplica — tiene salida a internet real. No perder tiempo intentando arreglarlo como si fuera un bug de la app.

2. **[2026-09-01] Puede haber DOS conectores MCP de Supabase a la vez, uno de ellos apuntando a un proyecto que NO es este.**
   Síntoma real: el conector `mcp__supabase__*` (sin `project_id` como parámetro, pinneado a un solo proyecto) resolvió a `cihcimdzwlmhedpprmhf` — un proyecto legado ajeno (nombres de política en español, `is_administrador()`) — mientras el proyecto real de este repo es `cgudnnlcwcotovcslgzu` ("V1-motoslam", ver `docs/database.md`). El conector correcto para este repo es el que SÍ acepta `project_id` en cada tool (`list_projects`/`execute_sql`/`apply_migration` con ese parámetro) — permite elegir el proyecto explícito por `list_projects()` en vez de confiar en cuál quedó pineado por la cuenta.
   Do instead: antes de la PRIMERA query o migración de una sesión nueva, correr `get_project_url()` (o `list_projects()` + comparar el `ref`) y confirmarlo contra `cgudnnlcwcotovcslgzu` — nunca asumir que "el MCP de supabase" conectado es el de este repo solo porque el nombre de la tool coincide.

3. **[2026-09-01] `apply_migration` (DDL) contra este proyecto es bloqueado por el clasificador de auto-modo, incluso para un cambio aditivo y trivial (`ALTER TYPE ... ADD VALUE`).**
   Do instead: no asumir que cualquier feature nueva necesita su propia migración — reutilizar un enum/columna ya existente si el caso de uso lo permite (ver Fase 7 abajo). Si de verdad hace falta DDL, ese paso queda pendiente de aprobación explícita del usuario en el chat, no se reintenta con otra forma de saltarlo.

4. **[2026-09-01] Este worktree no trae su propio `node_modules` — un git worktree nuevo necesita `npm install` propio antes de poder correr `next build`.**
   Síntoma engañoso: `npm run typecheck`/`npm run lint` corren bien SIN `node_modules` local porque Node resuelve `tsc`/`eslint` subiendo a un `node_modules` ancestro (otro worktree/repo principal) — pero `next build` (Turbopack) restringe la resolución de paquetes a la raíz del workspace detectado y falla con "Could not find the Next.js package" aunque el resto compile.
   Do instead: si typecheck/lint pasan "sospechosamente rápido" en un worktree recién creado, no dar por bueno el build sin correrlo — `npm install` primero si no hay `node_modules` local.

---

## ✅ Pasos manuales fuera de este entorno — ya resueltos (2026-09-02)

Ambos confirmados por captura del Dashboard de Supabase: "Customize Access Token (JWT) Claims hook" en **ENABLED** con `public.custom_access_token_hook`, y el proveedor **Google** en **Enabled** bajo Authentication → Sign In / Providers. El login ya funciona de punta a punta. Ver `docs/PENDIENTE.md` para lo que sigue pendiente de verdad (dominio corporativo, Fase 19).

---

## Supabase / RLS — decisiones y errores reales (MÁXIMA PRIORIDAD)

1. **[2026-08-31] Proyecto reutilizado: `V1-motoslam` (ref `cgudnnlcwcotovcslgzu`), no uno nuevo.**
   Do instead: era un sistema de vacaciones "PCG" sin uso, confirmado por el usuario y borrado por completo (tablas, tipos, función `rol_actual()`, políticas de storage) antes de crear el esquema del ATS. Queda un bucket `archivos` con 1 objeto huérfano que no se pudo borrar por SQL (`Direct deletion from storage tables is not allowed`) — pendiente de borrado manual por el usuario, no interfiere con el ATS.

2. **[2026-08-31] BUG REAL: recursión infinita (42P17) entre las políticas de `candidates` y `applications`.**
   Causa: `candidates_select` hacía `EXISTS` sobre `applications`, y `applications_select` hacía `EXISTS` sobre `candidates` — cada tabla dispara la política RLS de la otra en un ciclo.
   Do instead: cuando dos tablas se referencian mutuamente dentro de sus políticas, envolver una de las dos consultas en una función `SECURITY DEFINER` en `private` (aquí: `candidate_has_accessible_application`, `candidate_referred_by_me`). Al ser las tablas propiedad de `postgres` sin `FORCE ROW LEVEL SECURITY`, la función ejecuta como su dueño y no re-dispara RLS. Se encontró simulando JWTs reales por rol, no leyendo el SQL — **toda política nueva se prueba así antes de darla por buena**.

3. **[2026-08-31] Rol y organización viajan en el JWT vía custom access token hook — requiere un paso manual fuera del MCP.**
   Do instead: la función `public.custom_access_token_hook` ya existe en la base, pero Supabase Auth no la invoca hasta que alguien la selecciona en Dashboard → Authentication → Hooks → "Customize Access Token (JWT) Claims hook". Sin ese clic, `private.auth_role()`/`auth_org_id()` devuelven `null` para todos y **todas las políticas RLS deniegan todo**. Verificar esto primero si algo "no debería estar vacío pero lo está" en la Fase 3.

4. **[2026-08-31] `private.*()` sin argumentos siempre envueltas en `(select ...)` dentro de USING/WITH CHECK.**
   Do instead: `(select private.auth_org_id())`, `(select auth.uid())`, etc. — si no, Postgres las re-evalúa fila por fila (advisor `auth_rls_initplan`). Las que sí toman una columna de la fila como argumento (`can_access_job(id)`) se dejan tal cual, no hay nada que precalcular.

5. **[2026-08-31] Storage: DELETE directo sobre `storage.objects`/`storage.buckets` está bloqueado por Postgres (`storage.protect_delete()`).**
   Do instead: para borrar buckets u objetos hace falta la Storage API con `service_role_key`, no SQL. INSERT sí funciona directo (así se crearon `marca-publico` y `cvs-privado`).

6. **[2026-08-31] Extensión `pg_net` no soporta `ALTER EXTENSION ... SET SCHEMA`.**
   Do instead: si el advisor de seguridad marca "Extension in Public" para `pg_net`, no intentar moverla — falla con `0A000`. Dejarla y documentar como aceptada si no la instalamos nosotros.

7. **[2026-08-31] `profiles` necesita una política de "ver mi propia fila" independiente del JWT hook.**
   Do instead: `profiles_select_own using (id = (select auth.uid()))`, separada de `profiles_select_org` (que depende de `auth_org_id()`). Si no existe, nadie puede leer ni su propio perfil mientras el hook del paso manual #1 no esté activado — se rompe el callback de login completo.

8. **[2026-08-31] "No dejar la organización sin super admin" necesita defensa en dos capas, no una.**
   Causa: un chequeo optimista en el Server Action (`wouldRemoveLastSuperAdmin`, lee el conteo antes del UPDATE) tiene una carrera real entre dos requests concurrentes que pasan el conteo antes de que cualquiera confirme.
   Do instead: la capa que de verdad protege es un trigger `BEFORE UPDATE` en `profiles` (`private.guard_last_super_admin`) con `pg_advisory_xact_lock(hashtext(organization_id::text))` antes de contar — serializa las transacciones concurrentes sobre la misma organización. El chequeo en el Server Action solo existe para dar un mensaje de error específico en el caso normal (no concurrente); si el trigger es quien bloquea, el usuario ve el mensaje genérico "No se pudo actualizar" — aceptable, la integridad de datos no depende del mensaje.

9. **[2026-08-31] BUG REAL: un login rechazado (perfil faltante o dominio no permitido) deja un `auth.users` huérfano que bloquea reintentos para siempre.**
   Causa: `handle_new_user` es un trigger `AFTER INSERT` en `auth.users` — solo se dispara una vez, al crear la cuenta. Si el callback rechaza esa sesión sin borrar la cuenta, un reintento de login reutiliza la misma fila de `auth.users` (no hay INSERT nuevo) y el trigger nunca vuelve a correr.
   Do instead: en **todo** camino de rechazo post-login (perfil faltante, dominio no permitido, inactivo no cuenta porque ahí sí hay perfil válido) llamar `createAdminClient().auth.admin.deleteUser(user.id)` antes de redirigir a la página de error — no solo en el caso que se te ocurrió primero. Se encontró porque un review notó que solo la rama de dominio-rechazado borraba la cuenta.

10. **[2026-09-01] BUG REAL (pendiente, no corregido): `error_reports_select`/`error_report_messages_select` no validan `organization_id` en la rama `is_super_admin()`.**
    Causa: la política es `reporter_id = auth.uid() OR is_super_admin()` — `private.is_super_admin()` solo mira el rol del JWT, nunca la organización. Hoy sin impacto real (un solo tenant), pero es el mismo patrón de fuga cross-tenant que la regla de AGENTS.md pide evitar.
    Do instead (cuando se apruebe una migración): agregar `organization_id = (select private.auth_org_id())` a ambas políticas. Mientras tanto, Fase 7 lo mitiga filtrando `organization_id` explícito en cada función de `src/lib/errors/get-error-reports.ts` y `src/lib/errors/actions.ts` — mitigación de capa de app, no reemplaza el fix real en la política.

---

## Vacantes y postulación (Fase 4) — MÁXIMA PRIORIDAD

1. **[2026-08-31] BUG REAL, crítico: la ruta de Storage del CV no coincidía con lo que la política RLS de `storage.objects` espera — encontrado al empezar Fase 5, no en Fase 4.**
   Causa: `cvs_privado_select`/`cvs_privado_delete` (creadas en Fase 2) exigen que el **segundo** segmento de la ruta sea el `candidate_id` (`private.can_access_candidate((storage.foldername(name))[2]::uuid)`). El Route Handler de Fase 4 subía el CV a `{organization_id}/{email}/{timestamp}.pdf` — el segundo segmento era un correo, no un UUID. Cualquier intento real de leer o firmar esa URL habría fallado (el cast `::uuid` de un email lanza una excepción de Postgres), dejando el control de acceso a CVs completamente roto desde el primer commit de Fase 4, sin que nada en el flujo de postulación lo hiciera evidente (subir y crear seguían funcionando).
   Do instead: **antes de subir cualquier archivo a un bucket privado, leer la política RLS de `storage.objects` para ese bucket y confirmar el formato de ruta exacto que espera** (`storage.foldername(name)` da un array; su índice depende de qué escribió la política, no de lo que parezca lógico). Aquí significó resolver/crear el candidato ANTES de subir el CV (no después), para poder construir la ruta con su id real — ver `findOrCreateCandidate`/`createApplicationForCandidate` en `src/lib/jobs/create-application.ts`.

2. **[2026-08-31] BUG REAL, crítico: usar el cliente de sesión para leer tablas admin-only rompe el flujo principal del producto.**
   Causa: `materializeJobStages()` (copia la plantilla de pipeline al crear una vacante) usaba el cliente de sesión del actor. `pipeline_templates` y `job_stages` solo tienen políticas de escritura/lectura para `admin+` (`pipeline_templates_admin`, `job_stages_write_admin`) — un `gestor` puede crear su propia vacante (RLS de `jobs_insert` sí lo permite), pero su `SELECT` a `pipeline_templates` siempre vuelve vacío. Resultado: **todo gestor que solicitaba una vacante recibía "No hay una plantilla de pipeline configurada"**, aunque sí existiera — el caso de uso principal del producto ("gestor solicita plazas") estaba roto en Fase 4 desde el primer commit.
   Do instead: cualquier operación que necesite una verdad de la organización que no dependa de lo que el actor de turno puede ver por RLS (copiar una plantilla, deduplicar un candidato por correo) usa `createAdminClient()` internamente, sin importar qué cliente pasó el llamador — nunca asumir que "ya está autenticado" es suficiente para leer una tabla que RLS reserva a otro rol. Antes de dar una función por buena, simular con el rol de menor privilegio que la va a usar de verdad (aquí: `gestor`, no `admin`).

3. **[2026-08-31] Deduplicar por email con `.ilike()` es un bug, no una mejora — `%` y `_` son comodines de SQL.**
   Do instead: usar siempre `.eq("email", email)` (con el email ya en minúsculas) para un lookup de igualdad exacta. `ilike` solo tiene sentido para búsquedas de texto libre, nunca para una clave de deduplicación — un correo con `_` (frecuentísimo en direcciones corporativas) puede matchear una fila completamente distinta.

4. **[2026-08-31] Un `.update(objeto)` de Supabase nunca puede *borrar* un campo si ese campo llega como `undefined`.**
   Causa: `JSON.stringify` omite las claves `undefined` antes de mandar el PATCH — Supabase nunca se entera de que existían. Con los preprocesadores de Zod que convierten `""` a `undefined` (patrón ya usado en Fase 2/3), un formulario de edición que "vacía" un campo opcional en realidad deja el valor viejo intacto en la base, con un toast de éxito engañoso.
   Do instead: normalizar explícitamente los campos opcionales a `null` (nunca dejarlos en `undefined`) justo antes de armar el objeto que se pasa a `.update()`/`.insert()`.

5. **[2026-08-31] Toda transición de estado compartido (aprobar/cancelar/publicar) necesita compare-and-swap, no solo "leer, validar, escribir".**
   Causa: dos clics casi simultáneos (dos pestañas, o un doble clic entre dos botones distintos que comparten el mismo `useTransition`) pueden ejecutar dos `UPDATE` sobre la misma fila después de que ambos leyeron el mismo estado "viejo" — el segundo pisa al primero en silencio, cada uno con su propio toast de éxito.
   Do instead: agregar `.eq("status", estadoQueSeLeyó)` al `UPDATE` (no solo `.eq("id", ...)`). Si la fila ya cambió, el `UPDATE` afecta 0 filas y el código ya trata eso como error — mismo patrón (más liviano) que el advisory lock de Fase 3 para el caso del último super admin.

6. **[2026-08-31] Un `UNIQUE` a nivel de aplicación (check-then-insert) siempre tiene una ventana de carrera — maneja el código `23505`, no solo el camino feliz.**
   Do instead: si el `INSERT` falla con `error.code === "23505"` justo después de que el `SELECT` de deduplicación no encontró nada, es casi seguro una carrera (doble clic, dos requests casi simultáneas) — volver a hacer el `SELECT` y usar esa fila en vez de fallar con un mensaje genérico. Aplica a cualquier dedup por email/slug construido como "buscar, si no existe crear".

7. **[2026-08-31] `published_at` solo se marca la primera vez que se publica, nunca en cada transición hacia "abierta".**
   Do instead: `if (!current.published_at)`, no `if (current.status !== "abierta")` — lo segundo reinicia la fecha cada vez que se reabre tras una pausa, y el portal público (ordenado por `published_at`) muestra una vacante de semanas como si fuera nueva.

8. **[2026-08-31] Todo validador de Zod en un formulario en español necesita su propio `{ error: "..." }` — incluso los que "seguro nunca van a fallar".**
   Causa: `.int()` sin mensaje propio, cuando `.positive()` sí lo tiene, deja pasar el texto default de Zod en inglés apenas alguien manda un valor no entero (posible con una llamada directa al endpoint, sin pasar por el `<input type="number">` del navegador).
   Do instead: revisar cada eslabón de una cadena Zod (`.int()`, `.min()`, `.max()`, `.positive()`, no solo el último), sobre todo en preprocesadores compartidos por varios campos (`optionalNumber` en `schema.ts`).

---

## Centro de errores (Fase 7) — MÁXIMA PRIORIDAD

1. **[2026-09-01] Ya existía infraestructura de bitácora genérica antes de Fase 7 — buscarla antes de inventar una nueva.**
   `private.audit_row_change(org_id, action, entity_type, entity_id, diff jsonb)` (SECURITY DEFINER) ya estaba escrita y ya hay un trigger real usándola (`audit_error_report_status` en `error_reports`, dispara en cada cambio de `status`). Fase 8 (bitácora) probablemente es solo la pantalla de lectura sobre `audit_log`, no construir el mecanismo de escritura desde cero.
   Do instead: antes de agregar logging/auditoría nueva a cualquier tabla, `select proname from pg_proc where prosrc ilike '%audit_log%'` primero.

2. **[2026-09-01] Contexto auto-capturado del navegador (mensaje de excepción, URL, user agent) se trunca ANTES de pasar por Zod, nunca después.**
   Causa: el límite de `ReportErrorSchema` está pensado para lo que escribe una persona (2000 caracteres es generoso para texto humano, corto para un `error.message` con causas anidadas o un stack serializado). Si se valida primero, el reporte del error real que se quiere reportar es exactamente el que falla el schema.
   Do instead: `truncate()` en `src/lib/errors/actions.ts` antes del `safeParse` — cualquier campo que venga de `window`/`navigator`/una excepción real, no de un `<input>` del usuario, se recorta antes de validar.

3. **[2026-09-01] Decisión consciente: un solo valor de enum `notification_type` (`respuesta_reporte_error`) cubre 3 direcciones distintas (reporte nuevo, respuesta de soporte, respuesta del reportante).**
   Motivo: agregar un segundo valor de enum es DDL, y el clasificador de auto-modo bloqueó incluso un `ALTER TYPE ... ADD VALUE` aditivo (ver categoría de arriba). Costo real: la preferencia de notificación es todo-o-nada para las 3 direcciones — un super admin no puede separar "avísame de reportes nuevos" de "avísame de respuestas en hilos que ya sigo".
   Do instead (si se aprueba una migración más adelante): dividir en 2-3 valores de enum reales y migrar `PREFERENCE_TYPES`/`NOTIFICATION_TYPE_LABEL` — no urgente mientras la organización tenga pocos super admin.

4. **[2026-09-01] Fase 7 no manda correo — solo notificación in-app.** Los `notify()` de `src/lib/errors/actions.ts` no pasan el campo `email`, a propósito: escribir las plantillas de React Email para "nuevo reporte"/"te respondieron" queda pendiente. El toggle de correo en Mis Preferencias para este tipo no hace nada todavía — no es un bug, pero si un review lo marca, la respuesta es "diseño, no falta terminar el campo".
   Do instead: si se pide correo real para esto, seguir el patrón de Fase 6 (`emails/`, `getEmailContext()`), no inventar uno nuevo.

---

## Notificaciones in-app y correo (Fase 6) — MÁXIMA PRIORIDAD

1. **[2026-09-01] BUG REAL, rompe el build: instanciar el SDK de un servicio externo a nivel de módulo revienta CUALQUIER página que lo importe, aunque sea indirecto.**
   Causa: `new Resend(process.env.RESEND_API_KEY)` a nivel de módulo en `send-email.ts` — si la key llega vacía (entorno sin Resend configurado todavía), el constructor lanza de inmediato. Como `notify.ts` importa `send-email.ts` y varias Server Actions (`jobs/actions.ts`, `applications/actions.ts`) importan `notify.ts`, **cualquier página que renderice esas Server Actions** (ni siquiera hace falta llamarlas) falla en `next build` con "Missing API key" al recolectar datos de la página.
   Do instead: nunca instanciar el cliente de un servicio externo (Resend, Stripe, etc.) a nivel de módulo si la app puede desplegarse sin esa key configurada — envolver la construcción en una función y crearlo perezosamente (memoizado con `??=`, no uno nuevo por llamada) solo cuando de verdad se va a usar. Se encontró al correr `npm run build` después de cablear los primeros disparadores reales de Fase 6, no en el commit que creó `send-email.ts` — probar el build completo, no solo `typecheck`, apenas un archivo nuevo entra en el grafo de imports de una página.

2. **`notifications` NO tiene política de INSERT para `authenticated` — a propósito, no es un descuido.**
   Do instead: `notify()` SIEMPRE usa `createAdminClient()`, nunca el cliente de sesión del actor que disparó el evento — casi nunca se notifica a uno mismo, y hay que leer la preferencia del DESTINATARIO, no la del actor.

3. **Un fallo al notificar/enviar correo nunca debe convertir una mutación ya exitosa en un error de cara al usuario — usar `after()` de Next, no solo un `try/catch` inline.**
   Causa real encontrada en `/code-review`: los primeros cuatro sitios que dispararon `notify()`/`sendEmail()` lo hacían con `await` normal justo antes del `return`/`NextResponse.json` — si `notify()` lanzaba (red, un render de React Email que falla), la Server Action/Route Handler entera fallaba pese a que el job/postulación/etapa ya había quedado guardado en la base.
   Do instead: envolver todo trabajo de notificación best-effort en un helper (`notifyBestEffort()` en `notify.ts`) que use `after()` (`next/server`, estable desde Next 15.1) para correr DESPUÉS de responder, con su propio `try/catch` + `console.error` (no silencioso del todo — hasta que exista Centro de errores en Fase 7). `after()` sí puede leer `headers()`/`cookies()` dentro de Server Actions y Route Handlers (no en Server Components).

4. **Habilitar Realtime en una tabla nueva requiere agregarla explícito a la publicación — no es automático.**
   Do instead: `alter publication supabase_realtime add table notifications;` (migración aparte). Sin esto, `.channel(...).on("postgres_changes", ...)` se suscribe sin error pero nunca recibe nada — no hay mensaje de fallo visible, solo silencio.

5. **Un listener de Realtime en UPDATE debe ser idempotente usando solo `payload.new` — `payload.old` no trae columnas completas salvo `REPLICA IDENTITY FULL`.**
   Do instead: si el propio código ya filtra las escrituras que disparan el evento (aquí: `markAsRead`/`markAllAsRead` solo tocan filas con `read_at is null`), cada UPDATE recibido ya implica una transición real — no hace falta diffear contra el valor viejo. Cuidado con doble-contar: si el mismo cliente ya actualizó su estado local de forma optimista (clic propio), el eco de Realtime que vuelve debe detectar que ya estaba contado (comparar contra el estado local) y no restar dos veces.

6. **Toda tabla con `organization_id` necesita que la política RLS lo valide contra el JWT, no solo el resto de columnas — aunque esas otras columnas ya sean suficientes para bloquear acceso cruzado.**
   Causa: `notification_preferences` se creó con `organization_id` pero la policy solo comprobaba `profile_id = auth.uid()` — sin exposición real (un `profile_id` ya pertenece a un solo org), pero viola la letra de la regla de AGENTS.md y deja una columna que un cliente arbitrario podría poblar con cualquier UUID.
   Do instead: `using (profile_id = (select auth.uid()) and organization_id = private.auth_org_id())`, igual en `with check` — mismo patrón que cualquier otra tabla org-scoped, sin excepción "porque total ya está protegida por otro lado".

7. **Gotcha ya documentado (Fase 3), reapareció igual: objeto con clave computada rompe el excess-property check de `.upsert()` tipado.**
   Do instead: `const channelUpdate: Partial<Record<"in_app" | "email", boolean>> = { [canal]: enabled }`, spread aparte — ver `preferences-actions.ts`. Sigue siendo la trampa más recurrente del proyecto con Supabase tipado.

8. **`mencion_nota` y `respuesta_reporte_error` existen en el enum `notification_type` pero no se disparan todavía.**
   Do instead: no armar un selector de preferencias para un tipo que nunca ocurre — `PREFERENCE_TYPES` los excluye a propósito. `mencion_nota` depende de un selector de @mención en `NoteForm` (no construido en Fase 5); `respuesta_reporte_error` es de Fase 7.

9. **Pendiente para Fase 8 (hardening), no bloqueante ahora: `getSiteUrl()` cae al header `Host` del request si falta `NEXT_PUBLIC_SITE_URL`, y Fase 6 empezó a usarlo desde `/api/postular` (ruta pública, sin sesión) para armar el link de "Ver la postulación" en el correo que le llega a RH.**
   Riesgo: si en producción se olvida configurar `NEXT_PUBLIC_SITE_URL`, un solicitante malicioso podría mandar un `Host` falso y que el correo interno de "nueva postulación" incluya un link de phishing. `getSiteUrl()` documenta que su único uso sensible conocido era `signInWithGoogle()` (protegido por la lista de Redirect URLs de Supabase) — ya no es cierto, revisar ese comentario al tocar Fase 8.
   Do instead en Fase 8: verificar que `NEXT_PUBLIC_SITE_URL` esté seteado en Vercel antes de desplegar, y considerar que `getSiteUrl()` rechace el fallback a `Host` para cualquier link que salga en un correo (no solo para el OAuth redirect).

---

## Pipeline y candidatos (Fase 5) — MÁXIMA PRIORIDAD

1. **[2026-08-31] BUG REAL: usar `!` sobre un join embebido de Supabase asume que RLS siempre lo deja pasar — a veces no.**
   Causa: `applications_select` deja ver una postulación a un colaborador que refirió al candidato (`candidate_referred_by_me`), sin exigir nada sobre el estado de la vacante. Pero `jobs_select`/`job_stages_select` sí exigen que la vacante siga pública+abierta o que el actor tenga acceso interno. Si la vacante se pausa o cierra después, ese mismo colaborador sigue viendo la postulación pero el `jobs(title)`/`job_stages(name)` embebido en el mismo `select()` vuelve `null` — `app.jobs!.title` truena con un `TypeError` en producción, justo el "stack crudo frente al usuario" que AGENTS.md prohíbe.
   Do instead: cuando dos tablas relacionadas en un mismo `.select()` tienen políticas RLS **distintas** (una más permisiva que la otra), el campo embebido de la tabla más restrictiva es opcional de verdad — tipar como `T | null`, usar `?.` y mostrar un texto de reemplazo ("Vacante no disponible"), nunca `!`. Antes de asumir que un join embebido siempre viene, comparar las políticas RLS de ambas tablas, no solo la de la tabla principal del `select()`.

2. **[2026-08-31] BUG REAL (forma de IDOR): un id que es clave primaria global (no particionada por padre) no prueba que la fila pertenezca al padre correcto.**
   Causa: `moveApplicationStage(applicationId, fromStageId, toStageId)` actualizaba `applications.stage_id` sin verificar que `fromStageId`/`toStageId` fueran etapas de la MISMA vacante que la postulación — `job_stages.id` es un UUID global, cualquier etapa de cualquier vacante de la organización es "válida" para el `UPDATE` mientras no se compare contra `job_id`. Una Server Action es un endpoint invocable por red, no solo lo que la UI de arrastre manda.
   Do instead: cuando un id de un recurso "hijo" (etapa, columna, ítem de catálogo) llega desde el cliente para actualizar un recurso "padre" (postulación, vacante), verificar explícitamente `SELECT ... WHERE id IN (...) AND parent_id = ?` antes del `UPDATE` — el tipo de la columna (UUID) no garantiza pertenencia al padre correcto, eso es una regla de negocio que hay que comprobar aparte.

3. **[2026-08-31] PostgREST convierte `*` en `%` para `ilike`/`like` ANTES de que Postgres vea el patrón — no se puede escapar con `\`.**
   Causa: es un alias documentado (evita tener que codificar `%` en la URL), pero significa que un término de búsqueda con un `*` literal se vuelve un comodín real sin que el backslash-escape de siempre (`\%`, `\_`, `\\`) lo evite — el alias ocurre en una capa anterior a donde el escape de SQL aplicaría.
   Do instead: para búsquedas de texto libre construidas con `.or("campo.ilike.%...%")`, quitar `*` del término del usuario (no intentar escaparlo) además de escapar `%`/`_`/`\` de la forma normal, y de quitar `,`/`(`/`)` (sintaxis de filtros de PostgREST). Tres capas de caracteres especiales distintas en una sola búsqueda — fácil olvidar una.

4. **[2026-08-31] El compare-and-swap de Fase 4 (`.eq("status", estadoViejo")`) se reusa tal cual para el drag-and-drop del kanban.**
   Do instead: `moveApplicationStage` agrega `.eq("stage_id", fromStageId)` al `UPDATE`, igual que las transiciones de vacante — dos arrastres simultáneos sobre la misma tarjeta (dos pestañas, o un evento de red que tarda) no se pisan en silencio, el segundo simplemente no afecta filas y se reporta como conflicto.

---

## Auth con Supabase + Next.js 16 (Fase 3)

1. **[2026-08-31] Tres clientes de Supabase, cada uno para su contexto — nunca mezclar.**
   Do instead: `src/lib/supabase/client.ts` (browser, `createBrowserClient`) para client components; `src/lib/supabase/server.ts` (`createServerClient` + `next/headers` cookies) para Server Components/Actions — respeta RLS; `src/lib/supabase/admin.ts` (service role) solo para el portal público y tareas de servidor sin sesión de usuario — nunca importarlo desde un client component.

2. **`proxy.ts` es un chequeo optimista; la autorización real vive en `src/lib/auth/dal.ts`.**
   Do instead: `getProfile()` memoizado con `cache()` de React + `import "server-only"`, y `requireProfile()`/`requireAdminOrAbove()`/`requireSuperAdmin()` que redirigen a `/login` o a `/auth/auth-error?motivo=sin_permiso` — nunca un 403 crudo. El proxy solo redirige rápido leyendo la cookie, sin tocar la base.

3. **`Server Action` con dos parámetros (`updateUserRole(userId, role)`) no sirve para `useActionState`.**
   Do instead: si el formulario necesita `useActionState`, la action recibe `(prevState, formData)` y el campo variable va como input oculto en el propio `formData` (así se hizo con `uploadBrandImage`). Para acciones disparadas por `onClick`/`onChange` fuera de un `<form>`, usar `useTransition` + una función normal (así se hizo con `updateUserRole`/`toggleUserActive`).

4. **`.update({ [campoVariable]: valor })` con Supabase tipado rompe TypeScript (excess property check).**
   Do instead: tipar el objeto explícito antes, `const update: Partial<Record<Campo, Tipo>> = { [campo]: valor }`, y pasar `update` al `.update()`.

5. **[2026-08-31] `react-hooks/set-state-in-effect` es un ERROR duro en este proyecto (rompe el build), no un warning — y no siempre se resuelve igual.**
   Do instead: si el estado que quieres resetear viene de una prop que cambió (ej. el formulario de marca cuando otra pestaña guarda), usa `key={prop}` en el padre para forzar un remount — el patrón oficial de React, sin `useEffect`. Si el estado es un valor genuinamente solo-de-cliente sin prop de la que depender (ej. `new Date()` para el saludo o la fecha de `/inicio` — el reloj del servidor en Vercel es UTC, no el de Centroamérica), no hay prop que "keyear": ahí sí toca `useEffect` + `// eslint-disable-next-line react-hooks/set-state-in-effect` con un comentario que justifique por qué. **Bug real encontrado con el primer patrón**: el `key` del formulario de marca solo incluía `accent_color`, así que un cambio de solo `platform_name` no remontaba el formulario y una pestaña vieja podía pisar el nombre nuevo al guardar — el `key` debe incluir TODAS las props de las que depende el estado interno, no solo la que se probó primero.

---

## Next.js 16 — Cambios de ruptura (MÁXIMA PRIORIDAD)

1. **[2026-08-31] `middleware.ts` NO EXISTE. Ahora se llama `proxy.ts`.**
   Do instead: archivo `proxy.ts` en la raíz del proyecto o dentro de `src/`, al mismo nivel que `app/`. Exporta `export function proxy(request: NextRequest)` o un default export. `export const config = { matcher: [...] }` sigue igual. **Toda la documentación de `@supabase/ssr` en internet dice `middleware.ts` — está desactualizada para Next 16.** Verificado en `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`.

2. **[2026-08-31] Proxy corre en runtime de Node.js, no en Edge.**
   Do instead: se puede usar el SDK completo de Supabase dentro de `proxy.ts` sin preocuparse por compatibilidad con Edge. Solo leer la sesión de la cookie — **nunca consultar la base** desde el proxy, porque corre en cada ruta incluidas las prefetch.

3. **[2026-08-31] El proxy es un chequeo optimista, NO la capa de seguridad.**
   Do instead: la autorización real vive lo más cerca posible del dato: políticas RLS en Postgres + un Data Access Layer con `verifySession()` memoizado con `cache()` de React y `import 'server-only'` al inicio del archivo. El proxy solo redirige rápido.

3b. **[2026-08-31] `import "server-only"` no funciona si el paquete `server-only` no está instalado — Next NO lo trae solo.**
   Do instead: `npm install server-only` explícitamente. El build de Turbopack puede compilar igual sin él en algunos casos (alias interno), pero no depender de eso: instalarlo es el patrón documentado por Next.

3c. **[2026-08-31] `createServerClient` de `@supabase/ssr` en `proxy.ts`: toda redirección debe copiar las cookies de la respuesta que refrescó la sesión.**
   Do instead: `setAll()` reasigna `response` a un `NextResponse.next()` nuevo con las cookies puestas; si después decides redirigir, NO uses `NextResponse.redirect(url)` a secas — copia `response.cookies.getAll()` sobre la respuesta de redirect primero, o el refresh token recién rotado se pierde y el usuario entra en un loop de logout intermitente.

3d. **[2026-08-31] CVE de alta severidad: bypass de proxy/middleware en Turbopack (GHSA-6gpp-xcg3-4w24), corregido en Next 16.3.3.**
   Do instead: mantener Next en `^16.3.3` o superior. Se detectó vía `npm audit` mientras se construía `proxy.ts` — justo el mecanismo que el CVE afecta. Revisar `npm audit` en cada fase, no solo al final.

3e. **[2026-08-31] `organizations_select_public` es `using (true)` para `anon` Y `authenticated` — no depende del JWT hook.**
   Do instead: antes de asumir que un fallo de lectura en `/login` o en el callback de auth es "por el hook no activado todavía", verificar la policy real con `pg_policies`. Un review pasado marcó como bug que el login no podría leer `organizations` sin el hook — falso positivo, verificado contra la base real: esa tabla es pública por diseño para poder mostrar marca antes de iniciar sesión.

4. **[2026-08-31] `useActionState` devuelve `pending` — es la base de `<ActionButton>`.**
   Do instead: `const [state, action, pending] = useActionState(fn, initialState)`. No inventar estado de carga a mano con `useState`. Desde un event handler hay que envolver la llamada en `startTransition`.

5. **[2026-08-31] `global-error.tsx` debe declarar sus propios `<html>` y `<body>`.**
   Do instead: reemplaza al root layout cuando se activa, así que sin esas etiquetas la página queda rota. Los `error.tsx` anidados sí heredan el layout y burbujean al más cercano.

---

## Zod v4

1. **[2026-08-31] Los mensajes de error usan `{ error: "..." }`, no `{ message: "..." }`.**
   Do instead: `z.string().min(2, { error: "Muy corto." })`. La forma `message` es de Zod 3.

2. **[2026-08-31] `z.email()` es de primer nivel, no `z.string().email()`.**
   Do instead: `z.email({ error: "Correo inválido." })`.

3. **[2026-08-31] `z.coerce.number().optional()` devuelve `unknown` en el resolver de react-hook-form.**
   Do instead: `z.preprocess((v) => v === "" || v == null ? undefined : Number(v), z.number().optional())` para todo input numérico de HTML. (Trampa heredada del proyecto anterior, sigue vigente.)

---

## Supabase — RLS y Auth

1. **[2026-08-31] Nunca consultar `profiles` dentro de una política RLS de `profiles`.**
   Do instead: recursión infinita garantizada. El rol y el `organization_id` van en el JWT mediante un custom access token hook, y las políticas leen `auth.jwt()`. Las funciones auxiliares van en el esquema `private` como `SECURITY DEFINER STABLE`.

2. **[2026-08-31] Una tabla nueva sin política RLS es un bug bloqueante.**
   Do instead: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` en la misma migración que crea la tabla, siempre, incluso en tablas de configuración. Deny-by-default.

3. **[2026-08-31] El portal público NO escribe con el rol `anon`.**
   Do instead: las postulaciones entran por un Route Handler del servidor con service role, con validación Zod y rate limit. La `SUPABASE_SERVICE_ROLE_KEY` jamás lleva prefijo `NEXT_PUBLIC_` ni se importa en un client component.

4. **[2026-08-31] CVs en bucket privado con URL firmada, nunca pública.**
   Do instead: `createSignedUrl(path, 60)`. Una URL pública de Storage es permanente y adivinable.

---

## Tailwind v4

1. **[2026-08-31] La configuración vive en `src/app/globals.css` con `@theme inline`. NO existe `tailwind.config.ts`.**
   Do instead: tokens CSS en `:root {}` y `.dark {}`, mapeados en el bloque `@theme inline`. Nunca crear el archivo de config JS. (Trampa heredada, sigue vigente.)

---

## shadcn/ui v4

1. **[2026-08-31] `DropdownMenu`, `Select`, `Button`, `Dialog` usan `@base-ui/react` — NO aceptan `asChild`.**
   Do instead: pasar estilos por `className`. `Select.onValueChange` es `(v: string | null) => void` — usar `v ?? ""`.

2. **[2026-08-31] `Popover` usa `@radix-ui` y SÍ acepta `asChild`.**
   Do instead: no confundirlo con `DropdownMenu`. `<PopoverTrigger asChild>` funciona.

---

## Reglas del producto que se olvidan

1. **[2026-08-31] Todo botón de mutación usa `<ActionButton>`; toda eliminación usa `<DeleteButton>`.**
   Do instead: no escribir `<Button type="submit">` crudo para mutar. Eliminar siempre es rojo + ícono `X` + `<ConfirmDialog>`.

2. **[2026-08-31] Todo mensaje al usuario en español y concreto.**
   Do instead: `notifySuccess("Vacante publicada")`, nunca `"Éxito"`. Cero texto en inglés en la interfaz.

3. **[2026-08-31] El contenido lleva `pb-28` por el menú flotante inferior.**
   Do instead: sin ese padding la barra tapa el último elemento de toda lista.

4. **[2026-08-31] El color de acento es configurable por organización y alimenta `--ring` (el foco de teclado) — validar contraste, no solo formato hex.**
   Do instead: `src/lib/color-contrast.ts` calcula el contraste WCAG; `BrandingSchema` en `organizations/actions.ts` rechaza cualquier `accent_color` con menos de 3:1 contra el fondo `#faf9f7`, con un mensaje que explica por qué ("el foco de teclado no se vería"). Sin esto, un super admin podía elegir un acento claro y volver invisible el indicador de foco para cualquiera que navegue con teclado — viola "foco visible siempre".
