"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Briefcase, Home, Settings, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ADMIN_ROLES } from "@/lib/auth/role-labels";
import type { Database } from "@/lib/supabase/database.types";

type Role = Database["public"]["Enums"]["app_role"];

type NavItem = { href: string; label: string; icon: LucideIcon };

// Máximo 5 ítems por rol.
function itemsForRole(role: Role): NavItem[] {
  const base: NavItem[] = [
    { href: "/inicio", label: "Inicio", icon: Home },
    { href: "/vacantes", label: "Vacantes", icon: Briefcase },
  ];
  // Un colaborador refiere candidatos pero no gestiona el pipeline.
  if (role === "gestor" || ADMIN_ROLES.has(role)) {
    base.push({ href: "/candidatos", label: "Candidatos", icon: Users });
  }
  if (ADMIN_ROLES.has(role)) {
    base.push({ href: "/configuracion", label: "Ajustes", icon: Settings });
  }
  return base;
}

/**
 * Menú principal flotante: acompaña la pantalla sin invadirla. Se oculta al
 * bajar y reaparece al subir. Nunca una sidebar.
 */
export function FloatingNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = itemsForRole(role);
  const [visible, setVisible] = useState(true);
  const lastY = useRef(0);

  useEffect(() => {
    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const goingDown = y > lastY.current && y > 80;
        setVisible(!goingDown);
        lastY.current = y;
        ticking = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ y: 0, opacity: 1 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          className="fixed inset-x-0 bottom-6 z-40 flex justify-center"
        >
          <div className="flex items-center gap-0.5 rounded-full border border-primary bg-primary p-1.5">
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className="group relative flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium"
                >
                  {active && (
                    <motion.span
                      layoutId="floating-nav-indicator"
                      className="absolute inset-0 rounded-full bg-background"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span
                    className={`relative flex items-center gap-2 ${active ? "text-foreground" : "text-primary-foreground/60"}`}
                  >
                    <Icon className="size-[17px]" aria-hidden />
                    {active && <span>{item.label}</span>}
                  </span>
                  {!active && (
                    <span
                      role="tooltip"
                      // z-10: sin esto, el indicador activo (bg-background
                      // opaco) de un ítem vecino puede pintarse encima y
                      // recortar visualmente este tooltip cuando es más
                      // ancho que su propio botón (ej. "Candidatos").
                      className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
