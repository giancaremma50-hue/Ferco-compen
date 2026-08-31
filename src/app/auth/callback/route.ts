import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const proximo = sanitizeRedirectPath(searchParams.get("proximo"));

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-error?motivo=fallo_inicio`);
  }

  const supabase = await createClient();
  const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/auth/auth-error?motivo=fallo_inicio`);
  }

  // exchangeCodeForSession ya trae el usuario — evita un segundo viaje de
  // red al servidor de Auth con getUser().
  const user = exchangeData.user;

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/auth-error?motivo=fallo_inicio`);
  }

  // El trigger handle_new_user ya creó el perfil. Verificamos dominio
  // permitido y estado activo antes de dejarlo entrar.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active, role, email, organizations(allowed_email_domain)")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // Sesión válida pero sin fila en profiles (el trigger debió crearla y
    // falló). Sin este signOut, proxy.ts rebota /login <-> /inicio para
    // siempre: ve una sesión activa y nunca deja quedarse en /login.
    await supabase.auth.signOut();
    // handle_new_user es un trigger AFTER INSERT en auth.users: si no se
    // borra este usuario huérfano, un reintento de login reutiliza la
    // misma fila de auth.users (no dispara un INSERT nuevo) y esta persona
    // queda bloqueada para siempre en fallo_inicio.
    await createAdminClient().auth.admin.deleteUser(user.id);
    return NextResponse.redirect(`${origin}/auth/auth-error?motivo=fallo_inicio`);
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/auth-error?motivo=inactivo`);
  }

  const allowedDomain = profile.organizations?.allowed_email_domain;
  const emailDomain = profile.email.split("@")[1]?.toLowerCase();

  if (
    allowedDomain &&
    profile.role !== "super_admin" &&
    emailDomain !== allowedDomain.toLowerCase()
  ) {
    await supabase.auth.signOut();
    // handle_new_user ya creó auth.users + profiles para esta cuenta
    // rechazada. Se borra por completo (profiles cae en cascada) en vez de
    // dejar un perfil huérfano y activo dando vueltas en /configuracion/usuarios.
    await createAdminClient().auth.admin.deleteUser(user.id);
    return NextResponse.redirect(`${origin}/auth/auth-error?motivo=dominio_no_permitido`);
  }

  return NextResponse.redirect(`${origin}${proximo}`);
}
