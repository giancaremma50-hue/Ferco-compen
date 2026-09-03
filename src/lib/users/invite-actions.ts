"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { ASSIGNABLE_ROLES } from "@/lib/auth/role-labels";
import { createClient } from "@/lib/supabase/server";
import { zodFieldError } from "@/lib/forms/zod-error";
import type { Database } from "@/lib/supabase/database.types";

type AppRole = Database["public"]["Enums"]["app_role"];

export type InviteActionResult = { error?: string; success?: string; field?: string };

// Solo super admin puede invitar (mismo alcance que asignar el rol
// directamente — ver profile_invites_super_admin en la base) — se valida
// dos veces, aquí y en RLS, igual que el resto de acciones de usuarios.
const InviteSchema = z.object({
  email: z.email({ error: "Correo inválido." }).transform((e) => e.toLowerCase()),
  // Lista blanca, mismo motivo que en users/actions.ts: sin esto se podía
  // invitar a alguien con un rol que ya no existe en el producto.
  role: z.enum(ASSIGNABLE_ROLES, { error: "Elige un rol." }),
});

export async function createInvite(
  _prevState: InviteActionResult | undefined,
  formData: FormData,
): Promise<InviteActionResult> {
  const profile = await requireSuperAdmin();
  const parsed = InviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodFieldError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.from("profile_invites").insert({
    organization_id: profile.organization_id,
    email: parsed.data.email,
    role: parsed.data.role as AppRole,
    invited_by: profile.id,
  });

  if (error) {
    // 23505: unique_violation — ya existe una invitación para ese correo.
    if (error.code === "23505") {
      return { error: "Ese correo ya tiene una invitación. Elimínala primero si quieres cambiar el rol.", field: "email" };
    }
    return { error: "No se pudo guardar la invitación." };
  }

  revalidatePath("/configuracion/usuarios");
  return { success: "Invitación guardada" };
}

export async function deleteInvite(id: string): Promise<void> {
  const profile = await requireSuperAdmin();
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) throw new Error("Id inválido.");

  const supabase = await createClient();
  // .eq("organization_id", ...) es defensa en profundidad, igual que en
  // loadTarget()/updateUserRole() — RLS ya lo exige, pero un error en la
  // policy no debe ser la única barrera contra borrar la fila de otra
  // organización.
  const { error } = await supabase
    .from("profile_invites")
    .delete()
    .eq("id", parsedId.data)
    .eq("organization_id", profile.organization_id);
  if (error) throw new Error("No se pudo eliminar la invitación.");

  revalidatePath("/configuracion/usuarios");
}
