"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { WizardStep1Schema, WizardStep2Schema, WizardStep3Schema, WizardStep4Schema, WizardStep5Schema } from "./wizard-schema";
import { assertBelongsToOrg } from "@/lib/assert-belongs-to-org";

export type WizardActionResult = { error?: string };

// `job_templates.wizard_step` guarda "el próximo paso a retomar", no el
// último completado — cada acción de guardado lo avanza a N+1 al terminar.
// Sirve para que "Continuar" en el listado sepa a qué paso volver: inferirlo
// de qué filas existen no es confiable (0 preguntas o 0 etapas intermedias
// son estados válidos, no "paso sin completar"). No retrocede si se
// revisita un paso anterior ya avanzado más allá — aceptado, ver napkin.md.

/**
 * Paso 1 del wizard: crea la plantilla en `status = 'draft'` (default de la
 * columna, Fase 18 1/7) y redirige al paso 2. `created_by` no se manda —
 * tiene `DEFAULT auth.uid()` desde la misma fase, se resuelve solo con el
 * actor real de esta request.
 */
export async function createTemplateDraftStep1(
  _prevState: WizardActionResult | undefined,
  formData: FormData,
): Promise<WizardActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = WizardStep1Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const supabase = await createClient();

  const departmentError = await assertBelongsToOrg(supabase, "departments", parsed.data.department_id, profile.organization_id, "Ese departamento no es válido.");
  if (departmentError) return { error: departmentError };

  const { data: template, error } = await supabase
    .from("job_templates")
    .insert({
      organization_id: profile.organization_id,
      name: parsed.data.name,
      title: parsed.data.title,
      department_id: parsed.data.department_id ?? null,
      country: parsed.data.country,
      location: parsed.data.location,
      work_mode: parsed.data.work_mode,
      employment_type: parsed.data.employment_type,
      description: parsed.data.description,
      requirements: parsed.data.requirements,
      competencies: parsed.data.competencies,
      wizard_step: 2,
    })
    .select("id")
    .single();

  if (error || !template) return { error: "No se pudo crear la plantilla." };

  revalidatePath("/configuracion/plantillas-vacante");
  redirect(`/configuracion/plantillas-vacante/${template.id}/paso-2?guardado=1`);
}

/**
 * Paso 1, revisitado desde "Atrás" del paso 2 (o desde "Continuar" en el
 * listado, para un borrador ya creado). Misma validación que la creación —
 * a diferencia de esa, esto es un UPDATE, así que reconfirma organización
 * (no solo id) antes de escribir, mismo patrón que updateJob.
 */
export async function updateTemplateStep1(
  templateId: string,
  _prevState: WizardActionResult | undefined,
  formData: FormData,
): Promise<WizardActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = WizardStep1Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const supabase = await createClient();

  const departmentError = await assertBelongsToOrg(supabase, "departments", parsed.data.department_id, profile.organization_id, "Ese departamento no es válido.");
  if (departmentError) return { error: departmentError };

  const { data, error } = await supabase
    .from("job_templates")
    .update({
      name: parsed.data.name,
      title: parsed.data.title,
      department_id: parsed.data.department_id ?? null,
      country: parsed.data.country,
      location: parsed.data.location,
      work_mode: parsed.data.work_mode,
      employment_type: parsed.data.employment_type,
      description: parsed.data.description,
      requirements: parsed.data.requirements,
      competencies: parsed.data.competencies,
      wizard_step: 2,
    })
    .eq("id", templateId)
    .eq("organization_id", profile.organization_id)
    .select("id");

  if (error || !data || data.length === 0) return { error: "No se pudo guardar. La plantilla ya no existe." };

  revalidatePath("/configuracion/plantillas-vacante");
  revalidatePath(`/configuracion/plantillas-vacante/${templateId}/paso-1`);
  redirect(`/configuracion/plantillas-vacante/${templateId}/paso-2?guardado=1`);
}

/**
 * Paso 2 ("Candidatura"). `email` se fuerza a "required" server-side, nunca
 * se lee del FormData — ver el comentario en WizardStep2Schema.
 */
export async function updateTemplateStep2(
  templateId: string,
  _prevState: WizardActionResult | undefined,
  formData: FormData,
): Promise<WizardActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = WizardStep2Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("job_templates")
    .update({ candidacy_fields: { ...parsed.data, email: "required" }, wizard_step: 3 })
    .eq("id", templateId)
    .eq("organization_id", profile.organization_id)
    .select("id");

  if (error || !data || data.length === 0) return { error: "No se pudo guardar. La plantilla ya no existe." };

  revalidatePath("/configuracion/plantillas-vacante");
  revalidatePath(`/configuracion/plantillas-vacante/${templateId}/paso-2`);
  redirect(`/configuracion/plantillas-vacante/${templateId}/paso-3?guardado=1`);
}

/**
 * Paso 3 ("Preguntas"). Reemplaza la lista completa (borra + reinserta),
 * mismo patrón que pipeline_template_stages/job_competencies — sin
 * transacción real (el cliente de Supabase JS no las soporta), aceptado ya
 * en Fase 9 para listas anidadas de bajo tráfico de escritura.
 *
 * Los ids de las preguntas se generan ACÁ (no se leen del RETURNING del
 * INSERT) porque Postgres no garantiza que el orden de las filas devueltas
 * por un INSERT en lote coincida con el orden de los valores insertados —
 * confiar en `insertedRows[i].id` para emparejar la pregunta i con sus
 * opciones habría podido mezclar preguntas y opciones de plantillas
 * distintas en el peor caso, o de la pregunta equivocada en el mejor.
 */
export async function updateTemplateStep3(
  templateId: string,
  _prevState: WizardActionResult | undefined,
  formData: FormData,
): Promise<WizardActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = WizardStep3Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa las preguntas." };

  const supabase = await createClient();

  const { data: template } = await supabase
    .from("job_templates")
    .select("id")
    .eq("id", templateId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (!template) return { error: "La plantilla ya no existe." };

  const { error: deleteError } = await supabase.from("job_template_questions").delete().eq("job_template_id", templateId);
  if (deleteError) return { error: "No se pudieron guardar las preguntas." };

  if (parsed.data.questions.length > 0) {
    const questionRows = parsed.data.questions.map((q, i) => ({
      id: crypto.randomUUID(),
      organization_id: profile.organization_id,
      job_template_id: templateId,
      prompt: q.prompt,
      type: q.type,
      position: i,
    }));

    const { error: questionsError } = await supabase.from("job_template_questions").insert(questionRows);
    if (questionsError) return { error: "No se pudieron guardar las preguntas." };

    // Solo las de opción múltiple — una pregunta "abierta" con opciones
    // colgadas (ej. el cliente las mandó igual tras cambiar el tipo sin
    // limpiarlas) no debe dejar filas huérfanas en job_template_question_options.
    // El cliente ya las limpia al cambiar el tipo (QuestionListEditor), pero
    // el cliente nunca es la barrera real.
    const optionRows = parsed.data.questions.flatMap((q, i) =>
      q.type === "multiple_choice"
        ? q.options.map((o, j) => ({
            organization_id: profile.organization_id,
            job_template_id: templateId,
            question_id: questionRows[i].id,
            label: o.label,
            is_expected: o.is_expected,
            position: j,
          }))
        : [],
    );

    if (optionRows.length > 0) {
      const { error: optionsError } = await supabase.from("job_template_question_options").insert(optionRows);
      if (optionsError) return { error: "No se pudieron guardar las opciones." };
    }
  }

  // Las preguntas ya quedaron guardadas — un fallo acá no debe convertir eso
  // en un error de cara al usuario, solo significa que "Continuar" en el
  // listado podría mandarlo de vuelta al paso 3 en vez del 4 la próxima vez.
  const { error: stepError } = await supabase
    .from("job_templates")
    .update({ wizard_step: 4 })
    .eq("id", templateId)
    .eq("organization_id", profile.organization_id);
  if (stepError) console.error("updateTemplateStep3: no se pudo avanzar wizard_step", stepError);

  revalidatePath("/configuracion/plantillas-vacante");
  revalidatePath(`/configuracion/plantillas-vacante/${templateId}/paso-3`);
  redirect(`/configuracion/plantillas-vacante/${templateId}/paso-4?guardado=1`);
}

/**
 * Paso 4 ("Etapas"). El cliente solo manda las etapas del MEDIO — "Bandeja
 * de entrada"/"Contratado"/"Descartado" las arma el servidor siempre con el
 * mismo texto y tipo, nunca las que mande el formulario (no hay ningún
 * campo para ellas en WizardStep4Schema, así que no hay nada que "confiar"
 * ahí ni por accidente). Mismo patrón "reemplaza todo" que el paso 3.
 *
 * "Guardar como set reutilizable" (`reusable_set_name`) es cómo nace un
 * `pipeline_templates` nuevo ahora que no existe una pestaña Pipelines
 * dedicada — solo las etapas intermedias (nunca los 3 tipos reservados),
 * mismo criterio que "empezar desde un set guardado" en sentido inverso. Se
 * valida el nombre ANTES de tocar job_template_stages: si el nombre ya
 * existe, la plantilla de este wizard no debe quedar a medio guardar por
 * un problema que en realidad es del set nuevo, no de esta plantilla.
 */
export async function updateTemplateStep4(
  templateId: string,
  _prevState: WizardActionResult | undefined,
  formData: FormData,
): Promise<WizardActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = WizardStep4Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa las etapas." };

  const supabase = await createClient();

  const { data: template } = await supabase
    .from("job_templates")
    .select("id")
    .eq("id", templateId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (!template) return { error: "La plantilla ya no existe." };

  // El mismo chequeo de más abajo decide si de verdad se crea el set
  // (nombre Y al menos una etapa) — este pre-check tiene que exigir
  // exactamente lo mismo, o podría bloquear el guardado completo de esta
  // plantilla por un nombre repetido de un set que ni se iba a crear.
  if (parsed.data.reusable_set_name && parsed.data.stages.length > 0) {
    const { data: existingSet } = await supabase
      .from("pipeline_templates")
      .select("id")
      .eq("organization_id", profile.organization_id)
      .ilike("name", parsed.data.reusable_set_name)
      .maybeSingle();
    // Solo evita la vuelta redonda más común (escribir todo, guardar, y
    // recién ahí enterarse) — la garantía real es el índice único
    // (organization_id, lower(name)) en la base; una carrera entre dos
    // guardados casi simultáneos con el mismo nombre nuevo la cierra esa
    // restricción, no este pre-check.
    if (existingSet) return { error: "Ya existe un set guardado con ese nombre." };
  }

  const { error: deleteError } = await supabase.from("job_template_stages").delete().eq("job_template_id", templateId);
  if (deleteError) return { error: "No se pudieron guardar las etapas." };

  const rows = [
    { title: "Bandeja de entrada", type: "postulado" as const },
    ...parsed.data.stages,
    { title: "Contratado", type: "contratado" as const },
    { title: "Descartado", type: "descartado" as const },
  ].map((s, i) => ({
    organization_id: profile.organization_id,
    job_template_id: templateId,
    title: s.title,
    type: s.type,
    position: i,
  }));

  const { error: insertError } = await supabase.from("job_template_stages").insert(rows);
  if (insertError) return { error: "No se pudieron guardar las etapas." };

  if (parsed.data.reusable_set_name && parsed.data.stages.length > 0) {
    const { data: newSet, error: setError } = await supabase
      .from("pipeline_templates")
      .insert({ organization_id: profile.organization_id, name: parsed.data.reusable_set_name })
      .select("id")
      .single();
    if (setError || !newSet) {
      // Puede fallar por una carrera real contra el índice único
      // (organization_id, lower(name)) si otro admin guardó el mismo
      // nombre nuevo casi al mismo instante — no bloquea el guardado de
      // ESTA plantilla, que ya quedó bien (job_template_stages arriba).
      console.error("updateTemplateStep4: no se pudo crear el set reutilizable", setError);
    } else {
      const { error: setStagesError } = await supabase.from("pipeline_template_stages").insert(
        parsed.data.stages.map((s, i) => ({
          organization_id: profile.organization_id,
          pipeline_template_id: newSet.id,
          name: s.title,
          type: s.type,
          position: i,
        })),
      );
      if (setStagesError) {
        console.error("updateTemplateStep4: no se pudieron guardar las etapas del set reutilizable", setStagesError);
        // Sin esto quedaría un pipeline_templates con nombre pero 0 etapas
        // — "Empezar desde un set guardado" lo ofrecería igual y vaciaría
        // la plantilla de quien lo elija, sin ningún beneficio real.
        await supabase.from("pipeline_templates").delete().eq("id", newSet.id);
      }
    }
  }

  const { error: stepError } = await supabase
    .from("job_templates")
    .update({ wizard_step: 5 })
    .eq("id", templateId)
    .eq("organization_id", profile.organization_id);
  if (stepError) console.error("updateTemplateStep4: no se pudo avanzar wizard_step", stepError);

  revalidatePath("/configuracion/plantillas-vacante");
  revalidatePath(`/configuracion/plantillas-vacante/${templateId}/paso-4`);
  redirect(`/configuracion/plantillas-vacante/${templateId}/paso-5?guardado=1`);
}

/**
 * Paso 5 ("Permisos y usos") — un solo switch, un solo campo que guardar.
 *
 * Este paso puede dejar al propio actor sin poder ver la fila que acaba de
 * guardar: `job_templates_update_admin` (escritura) no exige nada sobre
 * `is_confidential`/`created_by`, pero `job_templates_select`
 * (`can_view_job_template`) sí — si un admin que NO es el creador activa el
 * switch, el UPDATE escribe bien pero él mismo deja de cumplir la política
 * de lectura a partir de esa misma fila. Por eso:
 * 1. La existencia se confirma ANTES del update con un SELECT aparte — un
 *    `.select("id")` sobre el UPDATE (RETURNING) se habría filtrado por la
 *    política de lectura DESPUÉS de escribir, dando `data: []` (falso
 *    negativo: "no se pudo guardar" aunque sí se guardó) en vez de reflejar
 *    si la fila existía de verdad.
 * 2. Si el actor se queda sin acceso a la fila (recién confidencial y no es
 *    su creador ni super_admin), no se lo manda al paso 6 — ahí
 *    `getJobTemplateForWizard` ya no la vería y caería en un 404 sin
 *    explicación. Se lo manda al listado con un mensaje concreto en su lugar.
 */
export async function updateTemplateStep5(
  templateId: string,
  _prevState: WizardActionResult | undefined,
  formData: FormData,
): Promise<WizardActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = WizardStep5Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const supabase = await createClient();

  const { data: template } = await supabase
    .from("job_templates")
    .select("id, created_by")
    .eq("id", templateId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (!template) return { error: "La plantilla ya no existe." };

  const { error } = await supabase
    .from("job_templates")
    .update({ is_confidential: parsed.data.is_confidential, wizard_step: 6 })
    .eq("id", templateId)
    .eq("organization_id", profile.organization_id);

  if (error) return { error: "No se pudo guardar." };

  revalidatePath("/configuracion/plantillas-vacante");
  revalidatePath(`/configuracion/plantillas-vacante/${templateId}/paso-5`);

  const losesAccess = parsed.data.is_confidential && template.created_by !== profile.id && profile.role !== "super_admin";
  if (losesAccess) {
    redirect(`/configuracion/plantillas-vacante?confidencial=1`);
  }
  redirect(`/configuracion/plantillas-vacante/${templateId}/paso-6?guardado=1`);
}

/**
 * Paso 6 ("Cierre") — sin campos propios, todo lo demás ya se guardó paso a
 * paso. "Crear borrador" solo confirma y vuelve al listado (la plantilla ya
 * está en `status = 'draft'` desde que se creó); "Crear plantilla" es la
 * única acción que la marca `published` — recién ahí aparece en el
 * selector de "Solicitar vacante" (getPublishedJobTemplates).
 */
export async function saveTemplateAsDraft(
  templateId: string,
  _prevState: WizardActionResult | undefined,
  _formData: FormData,
): Promise<WizardActionResult> {
  const profile = await requireAdminOrAbove();
  const supabase = await createClient();

  const { data } = await supabase
    .from("job_templates")
    .select("status")
    .eq("id", templateId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (!data) return { error: "La plantilla ya no existe." };

  // "Crear borrador" no debe decir que guardó como borrador una plantilla
  // que ya estaba publicada — este botón no la des-publica, no toca
  // `status` en absoluto. En la práctica esto solo se alcanza escribiendo la
  // URL a mano (el wizard nunca la ofrece para una plantilla publicada), no
  // hace falta un flujo distinto, solo no mentir en el mensaje.
  revalidatePath("/configuracion/plantillas-vacante");
  redirect(`/configuracion/plantillas-vacante?${data.status === "published" ? "publicada" : "borrador"}=1`);
}

export async function publishTemplate(
  templateId: string,
  _prevState: WizardActionResult | undefined,
  _formData: FormData,
): Promise<WizardActionResult> {
  const profile = await requireAdminOrAbove();
  const supabase = await createClient();

  // El wizard es secuencial solo en la UI — nada impide llegar al paso 6
  // por URL directa sin haber pasado por el paso 4. Sin al menos una etapa,
  // la vacante creada desde esta plantilla nacería con un kanban vacío
  // (createJob copia job_template_stages tal cual, sin plantilla de
  // respaldo — ver jobs/actions.ts). Se bloquea acá, no en createJob: mejor
  // avisar al publicar que al crear la vacante, más tarde y más confuso.
  const { count: stageCount } = await supabase
    .from("job_template_stages")
    .select("id", { count: "exact", head: true })
    .eq("job_template_id", templateId);
  if (!stageCount) {
    return { error: "Esta plantilla todavía no tiene etapas — completá el paso \"Etapas\" antes de publicarla." };
  }

  const { data, error } = await supabase
    .from("job_templates")
    .update({ status: "published" })
    .eq("id", templateId)
    .eq("organization_id", profile.organization_id)
    .select("id");
  if (error || !data || data.length === 0) return { error: "No se pudo publicar la plantilla." };

  revalidatePath("/configuracion/plantillas-vacante");
  redirect(`/configuracion/plantillas-vacante?publicada=1`);
}
