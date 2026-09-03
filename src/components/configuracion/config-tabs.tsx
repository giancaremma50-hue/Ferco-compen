"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/configuracion/marca", label: "Marca", roles: ["super_admin"] },
  { href: "/configuracion/usuarios", label: "Usuarios y roles", roles: ["admin", "super_admin"] },
  { href: "/configuracion/departamentos", label: "Departamentos", roles: ["admin", "super_admin"] },
  { href: "/configuracion/motivos-rechazo", label: "Motivos de rechazo", roles: ["admin", "super_admin"] },
  { href: "/configuracion/plantillas-mensaje", label: "Plantillas de mensaje", roles: ["admin", "super_admin"] },
  { href: "/configuracion/plantillas-vacante", label: "Plantillas de puesto", roles: ["admin", "super_admin"] },
  { href: "/configuracion/errores", label: "Centro de errores", roles: ["super_admin"] },
];

export function ConfigTabs({ role }: { role: string }) {
  const pathname = usePathname();
  const visible = TABS.filter((t) => t.roles.includes(role));

  return (
    // overflow-x-auto + flex-none/whitespace-nowrap por pestaña: con 7
    // pestañas no caben en un celular sin importar cuánto se acorten los
    // rótulos — antes se desbordaban en silencio (cortadas contra el borde
    // de la pantalla) y encima el texto envolvía a 2 líneas. Ahora, si no
    // caben, se deslizan horizontalmente como cualquier barra de pestañas.
    // El difuminado del borde derecho (pointer-events-none, decorativo) es
    // la única pista de que hay más pestañas — sin él, la última visible se
    // ve simplemente cortada, igual que antes, y nada avisa que se puede
    // deslizar.
    <div className="relative">
      <nav className="flex gap-6 overflow-x-auto border-b border-border">
        {visible.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-none pb-3 text-[13px] whitespace-nowrap ${active ? "border-b-2 border-foreground font-medium text-foreground" : "text-muted-foreground"}`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
      />
    </div>
  );
}
