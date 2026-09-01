"use server";

import { redirect } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { WizardStep1Schema } from "./wizard-schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type WizardActionResult = { error?: string };

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
    })
    .select("id")
    .single();

  if (error || !template) return { error: "No se pudo crear la plantilla." };

  // Los pasos 2-6 (Candidatura, Preguntas, Etapas, Permisos y usos, Cierre)
  // son entregas siguientes de la Fase 18 — todavía no existen como
  // páginas. Redirigir ahí sería un enlace roto; se vuelve al listado, que
  // sí puede mostrar esta plantilla (como borrador) y confirmar el guardado.
  redirect(`/configuracion/plantillas-vacante?guardado=1`);
}
