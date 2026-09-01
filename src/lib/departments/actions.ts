"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { DepartmentSchema } from "./schema";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type DepartmentActionResult = { error?: string; success?: string };

// Normalizado a null explícito — un .insert()/.update() con undefined
// simplemente omite la clave (o, en update, no borra el campo viejo),
// gotcha ya documentado en napkin.md.
function normalizeDepartmentFields(data: { name: string; country?: string; head_profile_id?: string }) {
  return {
    name: data.name,
    country: data.country ?? null,
    head_profile_id: data.head_profile_id ?? null,
  };
}

/**
 * El cliente nunca es fuente de verdad: head_profile_id llega de un
 * <select> que ya solo lista gente de la org, pero un POST directo a esta
 * action no pasa por ahí — mismo patrón que la validación de colaboradores
 * en Fase 8.
 */
async function assertProfileInOrg(
  supabase: SupabaseClient<Database>,
  profileId: string | null,
  organizationId: string,
): Promise<boolean> {
  if (!profileId) return true;
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  return data !== null;
}

export async function createDepartment(
  _prevState: DepartmentActionResult | undefined,
  formData: FormData,
): Promise<DepartmentActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = DepartmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const supabase = await createClient();
  const fields = normalizeDepartmentFields(parsed.data);
  if (!(await assertProfileInOrg(supabase, fields.head_profile_id, profile.organization_id))) {
    return { error: "Esa persona no pertenece a tu organización." };
  }

  const { error } = await supabase.from("departments").insert({ organization_id: profile.organization_id, ...fields });
  if (error) {
    return { error: error.code === "23505" ? "Ya existe un departamento con ese nombre en ese país." : "No se pudo crear." };
  }

  revalidatePath("/configuracion/departamentos");
  return { success: "Departamento creado" };
}

export async function updateDepartment(
  id: string,
  _prevState: DepartmentActionResult | undefined,
  formData: FormData,
): Promise<DepartmentActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = DepartmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const supabase = await createClient();
  const fields = normalizeDepartmentFields(parsed.data);
  if (!(await assertProfileInOrg(supabase, fields.head_profile_id, profile.organization_id))) {
    return { error: "Esa persona no pertenece a tu organización." };
  }

  const { error } = await supabase.from("departments").update(fields).eq("id", id);
  if (error) {
    return { error: error.code === "23505" ? "Ya existe un departamento con ese nombre en ese país." : "No se pudo guardar." };
  }

  revalidatePath("/configuracion/departamentos");
  return { success: "Departamento actualizado" };
}

export async function deleteDepartment(id: string): Promise<void> {
  await requireAdminOrAbove();
  const supabase = await createClient();
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) throw new Error("No se pudo eliminar el departamento.");
  revalidatePath("/configuracion/departamentos");
}
