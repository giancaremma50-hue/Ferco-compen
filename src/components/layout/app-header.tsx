import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";
import { ROLE_LABEL } from "@/lib/auth/role-labels";
import { ActionButton } from "@/components/ui/action-button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { getInitials } from "@/lib/profile/initials";
import type { NotificationItem } from "@/lib/notifications/get-notifications";
import type { Tables } from "@/lib/supabase/database.types";

export function AppHeader({
  organization,
  profile,
  initialNotifications,
  initialUnreadCount,
}: {
  organization: Pick<Tables<"organizations">, "platform_name" | "logo_url">;
  profile: Pick<Tables<"profiles">, "id" | "display_name" | "role" | "avatar_url">;
  initialNotifications: NotificationItem[];
  initialUnreadCount: number;
}) {
  const initials = getInitials(profile.display_name);

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-border bg-card px-4 sm:px-6 lg:px-10">
      <div className="flex min-w-0 items-center gap-2.5">
        {organization.logo_url ? (
          <Image src={organization.logo_url} alt="" width={24} height={24} className="shrink-0 object-contain" />
        ) : (
          <div className="flex size-6 flex-none items-center justify-center border border-foreground">
            <span className="font-serif text-[15px] leading-none">
              {organization.platform_name.charAt(0)}
            </span>
          </div>
        )}
        {/* truncate + min-w-0: en un teléfono angosto un nombre de
            plataforma largo no debe empujar la campana/avatar fuera de
            pantalla — se corta con "…" en vez de forzar scroll horizontal. */}
        <span className="truncate font-serif text-lg">{organization.platform_name}</span>
        {profile.role === "super_admin" && (
          <span className="ml-2.5 hidden h-[22px] flex-none items-center rounded-sm border border-accent px-2 text-[11px] text-accent sm:inline-flex">
            Super admin
          </span>
        )}
      </div>

      <div className="flex flex-none items-center gap-2 sm:gap-3">
        <NotificationBell
          profileId={profile.id}
          initialItems={initialNotifications}
          initialUnreadCount={initialUnreadCount}
        />
        <span className="hidden text-xs text-muted-foreground md:inline">{ROLE_LABEL[profile.role]}</span>
        <Link href="/mi-cuenta" data-tour="mi-cuenta" className="flex items-center gap-2">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt=""
              width={30}
              height={30}
              className="size-[30px] rounded-full object-cover"
            />
          ) : (
            <div className="flex size-[30px] flex-none items-center justify-center rounded-full bg-primary text-[12px] font-medium text-primary-foreground">
              {initials}
            </div>
          )}
          {/* Nombre del usuario: solo desde sm — en celular el avatar solo
              (con su alt/aria implícito vía el link a "Mi cuenta") ya es
              suficiente affordance, y liberar ese espacio es lo que evita
              que esta fila se desborde. */}
          <span className="hidden text-[13px] sm:inline">{profile.display_name}</span>
        </Link>
        <form action={signOut}>
          <ActionButton
            variant="ghost"
            pendingLabel=""
            aria-label="Cerrar sesión"
            className="h-8 w-8 border-border p-0 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="size-4" aria-hidden />
          </ActionButton>
        </form>
      </div>
    </header>
  );
}
