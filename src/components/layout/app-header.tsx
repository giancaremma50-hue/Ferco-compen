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
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6 lg:px-10">
      <div className="flex items-center gap-2.5">
        {organization.logo_url ? (
          <Image src={organization.logo_url} alt="" width={24} height={24} className="object-contain" />
        ) : (
          <div className="flex size-6 items-center justify-center border border-foreground">
            <span className="font-serif text-[15px] leading-none">
              {organization.platform_name.charAt(0)}
            </span>
          </div>
        )}
        <span className="font-serif text-lg">{organization.platform_name}</span>
        {profile.role === "super_admin" && (
          <span className="ml-2.5 inline-flex h-[22px] items-center rounded-sm border border-accent px-2 text-[11px] text-accent">
            Super admin
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell
          profileId={profile.id}
          initialItems={initialNotifications}
          initialUnreadCount={initialUnreadCount}
        />
        <span className="text-xs text-muted-foreground">{ROLE_LABEL[profile.role]}</span>
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
            <div className="flex size-[30px] items-center justify-center rounded-full bg-primary text-[12px] font-medium text-primary-foreground">
              {initials}
            </div>
          )}
          <span className="text-[13px]">{profile.display_name}</span>
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
