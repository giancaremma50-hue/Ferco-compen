"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { WizardStep1Schema, WizardStep2Schema, WizardStep3Schema, WizardStep4Schema, WizardStep5Schema } from "./wizard-schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type WizardActionResult = { error?: string };

// `job_templates.wizard_step` guarda "el próximo paso a retomar", no el
// último completado — cada acción de guardado lo avanza a N+1 al terminar.
// Sirve para que "Continuar" en el listado sepa a qué paso volver: inferirlo
// de qué filas existen no es confiable (0 preguntas o 0 etapas intermedias
// son estados válidos, no "paso sin completar"). No retrocede si se
// revisita un paso anterior ya avanzado más allá — aceptado, ver napkin.md.

/**
 * El <select> del formulario ya solo ofrece departamentos de la propia
 * organización, pero una Server Action es un endpoint de red — mismo motivo
 * y misma forma que assertValidDepartment en jobs/actions.ts. No se extrae
 * todavía a un helper compartido: es la 2ª copia, no la 3ª (ver AGENTS.md /
 * napkin.md, Fase 9 — el umbral de este proyecto es 3-4 copias, no 2).
 */
async function assertValidDepartment(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  departmentId: string | undefined,
): Promise<string | null> {
  if (!departmentId) return null;
  const { data } = await supabase
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data ? null : "Ese departamento no es válido.";
}

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

  const departmentError = await assertValidDepartment(supabase, profile.organization_id, parsed.data.department_id);
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

  const departmentError = await assertValidDepartment(supabase, profile.organization_id, parsed.data.department_id);
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
