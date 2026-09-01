"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/configuracion/marca", label: "Marca", roles: ["super_admin"] },
  { href: "/configuracion/usuarios", label: "Usuarios y roles", roles: ["admin", "super_admin"] },
  { href: "/configuracion/departamentos", label: "Departamentos", roles: ["admin", "super_admin"] },
  { href: "/configuracion/pipelines", label: "Pipelines", roles: ["admin", "super_admin"] },
  { href: "/configuracion/motivos-rechazo", label: "Motivos de rechazo", roles: ["admin", "super_admin"] },
  { href: "/configuracion/plantillas-mensaje", label: "Plantillas de mensaje", roles: ["admin", "super_admin"] },
  { href: "/configuracion/plantillas-vacante", label: "Plantillas de vacante", roles: ["admin", "super_admin"] },
  { href: "/configuracion/errores", label: "Centro de errores", roles: ["super_admin"] },
];

export function ConfigTabs({ role }: { role: string }) {
  const pathname = usePathname();
  const visible = TABS.filter((t) => t.roles.includes(role));

  return (
    <nav className="flex gap-6 border-b border-border">
      {visible.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`pb-3 text-[13px] ${active ? "border-b-2 border-foreground font-medium text-foreground" : "text-muted-foreground"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
