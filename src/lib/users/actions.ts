"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { ASSIGNABLE_ROLES } from "@/lib/auth/role-labels";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];
type ActionResult = { error?: string; success?: boolean };

// Un Server Action es un endpoint invocable por red: los tipos de
// TypeScript no protegen en runtime contra una llamada fabricada a mano.
// Se valida con Zod igual que src/lib/organizations/actions.ts.
// z.enum sobre la LISTA BLANCA, no sobre el enum completo de Postgres: el
// desplegable ya no ofrece `colaborador`, pero un POST fabricado a mano sí
// podía mandarlo — limpiar solo la interfaz habría dejado el rol asignable
// por red. Un valor nuevo del enum tampoco se vuelve asignable por accidente.
const RoleSchema = z.enum(ASSIGNABLE_ROLES);
const UserIdSchema = z.uuid();

type Target = { role: AppRole; is_active: boolean };

// Next.js redacta el mensaje de un throw en un Server Action en producción
// (queda un texto genérico) — por eso estas acciones devuelven { error }
// en vez de lanzar, igual que src/lib/organizations/actions.ts.
async function loadTarget(
  actorOrgId: string,
  targetUserId: string,
): Promise<{ target?: Target; error?: string }> {
  const supabase = await createClient();
  const { data: target, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", targetUserId)
    .eq("organization_id", actorOrgId)
    .single();

  if (error || !target) {
    return { error: "No se encontró a esa persona en tu organización." };
  }
  return { target };
}

function guardCanEditTarget(actorRole: AppRole, target: Target): string | null {
  // Un admin normal no puede tocar la cuenta de un super admin, ni para
  // cambiarle el rol ni para desactivarlo. La misma regla vive además en
  // RLS (profiles_write_admin) para cerrar la ventana de una carrera entre
  // este chequeo y el UPDATE.
  if (target.role === "super_admin" && actorRole !== "super_admin") {
    return "Solo un super admin puede modificar a otro super admin.";
  }
  return null;
}

/**
 * Evita dejar la organización sin ningún super admin activo — sin esto, un
 * super admin podría degradar o desactivar al único otro super admin y
 * nadie más podría entrar a /configuracion/marca ni al centro de errores.
 */
async function wouldRemoveLastSuperAdmin(
  organizationId: string,
  excludingUserId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("role", "super_admin")
    .eq("is_active", true)
    .neq("id", excludingUserId);

  return (count ?? 0) === 0;
}

export async function updateUserRole(userId: string, role: AppRole): Promise<ActionResult> {
  const parsedUserId = UserIdSchema.safeParse(userId);
  const parsedRole = RoleSchema.safeParse(role);
  if (!parsedUserId.success || !parsedRole.success) {
    return { error: "Datos inválidos." };
  }

  const actor = await requireAdminOrAbove();
  if (parsedUserId.data === actor.id) {
    return { error: "No puedes editar tu propia cuenta desde aquí." };
  }

  const { target, error: loadError } = await loadTarget(actor.organization_id, parsedUserId.data);
  if (loadError || !target) return { error: loadError };

  const guardError = guardCanEditTarget(actor.role, target);
  if (guardError) return { error: guardError };

  if (parsedRole.data === "super_admin" && actor.role !== "super_admin") {
    return { error: "Solo un super admin puede asignar ese rol." };
  }

  if (target.role === "super_admin" && parsedRole.data !== "super_admin") {
    if (await wouldRemoveLastSuperAdmin(actor.organization_id, parsedUserId.data)) {
      return { error: "No puedes quitar al único super admin de la organización." };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role: parsedRole.data })
    .eq("id", parsedUserId.data)
    .eq("organization_id", actor.organization_id)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "No se pudo actualizar el rol." };
  }
  revalidatePath("/configuracion/usuarios");
  return { success: true };
}

export async function toggleUserActive(userId: string, isActive: boolean): Promise<ActionResult> {
  const parsedUserId = UserIdSchema.safeParse(userId);
  const parsedIsActive = z.boolean().safeParse(isActive);
  if (!parsedUserId.success || !parsedIsActive.success) {
    return { error: "Datos inválidos." };
  }

  const actor = await requireAdminOrAbove();
  if (parsedUserId.data === actor.id) {
    return { error: "No puedes editar tu propia cuenta desde aquí." };
  }

  const { target, error: loadError } = await loadTarget(actor.organization_id, parsedUserId.data);
  if (loadError || !target) return { error: loadError };

  const guardError = guardCanEditTarget(actor.role, target);
  if (guardError) return { error: guardError };

  if (target.role === "super_admin" && !parsedIsActive.data) {
    if (await wouldRemoveLastSuperAdmin(actor.organization_id, parsedUserId.data)) {
      return { error: "No puedes desactivar al único super admin de la organización." };
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: parsedIsActive.data })
    .eq("id", parsedUserId.data)
    .eq("organization_id", actor.organization_id)
    .select("id");

  if (error || !data || data.length === 0) {
    return { error: "No se pudo actualizar el estado." };
  }
  revalidatePath("/configuracion/usuarios");
  return { success: true };
}
