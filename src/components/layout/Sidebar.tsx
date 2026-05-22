"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, PlusCircle, Users, LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "@/lib/firebase/auth";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

const links = [
  {
    href: ROUTES.DASHBOARD,
    label: "Tablero",
    icon: LayoutDashboard,
    roles: ["administrador", "colaborador"] as const,
  },
  {
    href: ROUTES.NUEVA_SOLICITUD,
    label: "Nueva Solicitud",
    icon: PlusCircle,
    roles: ["administrador", "colaborador"] as const,
  },
  {
    href: ROUTES.ADMIN_USUARIOS,
    label: "Usuarios",
    icon: Users,
    roles: ["administrador"] as const,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace(ROUTES.LOGIN);
  }

  const visibleLinks = links.filter((l) =>
    userProfile ? (l.roles as readonly string[]).includes(userProfile.role) : false
  );

  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar min-h-[calc(100vh-4rem)]">
      <nav className="flex flex-col gap-1 p-4">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          const isActive =
            pathname === link.href ||
            (link.href !== ROUTES.DASHBOARD && pathname.startsWith(link.href));

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto p-4 border-t border-sidebar-border space-y-3">
        <div
          className="h-1 w-8 rounded-full"
          style={{ backgroundColor: "var(--gold)" }}
        />
        <p className="text-xs text-muted-foreground">
          Portal de Compensaciones
        </p>
        <p className="text-xs text-muted-foreground">Ferco Cerámica © 2026</p>

        {/* Sign-out button */}
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
