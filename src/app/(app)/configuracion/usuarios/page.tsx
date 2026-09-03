import { AlertTriangle } from "lucide-react";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";
import { getPendingInvites } from "@/lib/users/get-invites";
import { UserRow } from "@/components/configuracion/user-row";
import { CopyLoginLink } from "@/components/configuracion/copy-login-link";
import { InviteForm } from "@/components/configuracion/invite-form";
import { InviteRow } from "@/components/configuracion/invite-row";

export default async function UsuariosPage() {
  const profile = await requireAdminOrAbove();
  const supabase = await createClient();

  const [{ data: users, error }, siteUrl, invites] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, email, role, is_active")
      .eq("organization_id", profile.organization_id)
      .order("display_name"),
    getSiteUrl(),
    profile.role === "super_admin" ? getPendingInvites(profile.organization_id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <section className="border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="font-serif text-2xl">Usuarios y roles</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {error ? "No se pudo cargar la lista." : `${users?.length ?? 0} personas en la organización.`}
            </p>
          </div>
        </div>

        <div className="px-5">
          {error ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <AlertTriangle className="size-5 text-destructive" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Algo se rompió de nuestro lado al traer la lista. Recarga la página en unos segundos.
              </p>
            </div>
          ) : (
            <>
              {/* Encabezado de columnas solo tiene sentido con la fila de 3
                  columnas de escritorio — en celular las filas se apilan
                  (ver UserRow) y este encabezado no describiría nada. */}
              <div className="hidden gap-4 border-b border-border px-1 py-2.5 text-[11px] tracking-[0.08em] text-muted-foreground uppercase sm:grid sm:grid-cols-[1fr_180px_120px]">
                <span>Persona</span>
                <span>Rol</span>
                <span>Estado</span>
              </div>

              {users?.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelf={u.id === profile.id}
                  canAssignSuperAdmin={profile.role === "super_admin"}
                />
              ))}

              {(users?.filter((u) => u.id !== profile.id).length ?? 0) === 0 && (
                <div className="flex flex-col items-center gap-3 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    Aún no hay nadie más. Cualquiera con correo corporativo entra solo, con su cuenta de Google.
                  </p>
                  <CopyLoginLink url={`${siteUrl}/login`} />
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {profile.role === "super_admin" && (
        <section className="border border-border bg-card">
          <div className="border-b border-border p-5">
            <h2 className="font-serif text-2xl">Invitar por correo</h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Para alguien fuera del dominio corporativo (o antes de que entre por primera vez): entra
              automáticamente con el rol que le asignes aquí.
            </p>
          </div>
          <div className="p-5">
            <InviteForm />
            {invites.length > 0 && (
              <div className="mt-5 border-t border-border pt-1">
                {invites.map((i) => (
                  <InviteRow key={i.id} invite={i} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
