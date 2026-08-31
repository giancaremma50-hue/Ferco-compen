import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type Profile = Tables<"profiles">;

/**
 * La autorización real vive aquí y en RLS, no en proxy.ts. Memoizado con
 * cache() de React para que una sola request no repita la consulta.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile ?? null;
});

/** Redirige a /login si no hay sesión. Úsalo al inicio de layouts protegidos. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) {
    // Puede haber una sesión de Supabase válida sin fila en profiles (fila
    // borrada, error transitorio). /auth/auth-error con este motivo ofrece
    // un cierre de sesión de verdad (Server Action, sí puede escribir la
    // cookie) — un redirect a /login a secas dejaría a proxy.ts viendo una
    // sesión activa y rebotando de vuelta a /inicio para siempre.
    redirect("/auth/auth-error?motivo=fallo_inicio");
  }
  if (!profile.is_active) redirect("/auth/auth-error?motivo=inactivo");
  return profile;
}

const ADMIN_ROLES = ["admin", "super_admin"] as const;

/** Redirige con un mensaje amigable si el rol no alcanza — nunca un 403 crudo. */
export async function requireAdminOrAbove(): Promise<Profile> {
  const profile = await requireProfile();
  if (!ADMIN_ROLES.includes(profile.role as (typeof ADMIN_ROLES)[number])) {
    redirect("/auth/auth-error?motivo=sin_permiso");
  }
  return profile;
}

export async function requireSuperAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") {
    redirect("/auth/auth-error?motivo=sin_permiso");
  }
  return profile;
}
