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
    .select("is_active, role, email, organization_id, organizations(allowed_email_domain)")
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
  const domainMismatch = !!allowedDomain && emailDomain !== allowedDomain.toLowerCase();

  // profile_invites es la lista de excepciones: correos puntuales (fuera
  // del dominio corporativo) a los que un super admin les asignó un rol de
  // antemano — mismo trato que el correo del super admin, que ya está
  // exento arriba. Solo importa cuando el dominio no calza — si coincide,
  // no hay nada que decidir aquí (y de paso se evita una consulta extra en
  // el camino común: casi todos los logins son de gente cuyo correo sí es
  // del dominio corporativo).
  if (domainMismatch && profile.role !== "super_admin") {
    // Cliente ADMIN, no el de sesión: la única política de profile_invites
    // exige ser super_admin (`profile_invites_super_admin`), así que un
    // invitado como colaborador/gestor/admin nunca podría leer su propia
    // invitación con su propio cliente — con el cliente de sesión esto
    // siempre habría devuelto 0 filas y rechazado el login de cualquiera
    // que no fuera super_admin, justo el caso de uso real de esta función.
    const admin = createAdminClient();
    // .eq exacto, no .ilike: el correo se guarda siempre en minúsculas al
    // crear la invitación (ver invite-actions.ts) — ilike con un correo
    // que trajera "%"/"_" lo trataría como comodín de SQL en vez de
    // carácter literal.
    const { data: invite, error: inviteError } = await admin
      .from("profile_invites")
      .select("id, consumed_at")
      .eq("organization_id", profile.organization_id)
      .eq("email", profile.email.toLowerCase())
      .maybeSingle();

    // Un error de consulta (red, Supabase caído) no es lo mismo que "no
    // está invitado" — tratarlo como "no invitado" borraría la cuenta de
    // alguien legítimamente invitado por una falla transitoria. Se manda a
    // fallo_inicio (reintentable, no borra nada) en vez de asumir lo peor.
    if (inviteError) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/auth/auth-error?motivo=fallo_inicio`);
    }

    if (!invite) {
      await supabase.auth.signOut();
      // handle_new_user ya creó auth.users + profiles para esta cuenta
      // rechazada. Se borra por completo (profiles cae en cascada) en vez
      // de dejar un perfil huérfano y activo dando vueltas en
      // /configuracion/usuarios.
      await admin.auth.admin.deleteUser(user.id);
      return NextResponse.redirect(`${origin}/auth/auth-error?motivo=dominio_no_permitido`);
    }

    if (!invite.consumed_at) {
      // Best-effort: ya se usó para decidir el acceso (y handle_new_user()
      // ya asignó el rol en profiles) — un fallo aquí solo significa que
      // sigue apareciendo como "pendiente" un rato más, nada que bloquee
      // el login. NUNCA se borra la fila: el filtro de dominio corre en
      // CADA login, no solo el primero, así que borrarla expulsaría y
      // borraría la cuenta de este mismo invitado la segunda vez que
      // entrara.
      await admin.from("profile_invites").update({ consumed_at: new Date().toISOString() }).eq("id", invite.id);
    }
  }

  return NextResponse.redirect(`${origin}${proximo}`);
}
