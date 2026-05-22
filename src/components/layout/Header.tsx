"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "@/lib/firebase/auth";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/constants/routes";

export function Header() {
  const { userProfile } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.replace(ROUTES.LOGIN);
  }

  const initials = userProfile?.displayName
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "U";

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Link href={ROUTES.DASHBOARD} className="flex items-center">
        <Image
          src="/logo-negro.png"
          alt="Ferco Cerámica"
          width={140}
          height={42}
          className="object-contain dark:hidden"
          priority
        />
        <Image
          src="/logo-blanca.png"
          alt="Ferco Cerámica"
          width={140}
          height={42}
          className="object-contain hidden dark:block"
          priority
        />
      </Link>

      <div className="flex items-center gap-2">
        <NotificationBell />

        <DropdownMenu>
          {/* base-ui trigger: apply button styles directly, no asChild needed */}
          <DropdownMenuTrigger
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold cursor-pointer select-none transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Menú de usuario"
          >
            {initials}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1 px-1 py-0.5">
                <p className="text-sm font-medium leading-none">
                  {userProfile?.displayName}
                </p>
                <p className="text-xs leading-none text-muted-foreground mt-1">
                  {userProfile?.email}
                </p>
                <p className="text-xs leading-none text-muted-foreground mt-0.5 capitalize">
                  {userProfile?.role === "administrador" ? "Administrador" : "Colaborador"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive cursor-pointer"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
