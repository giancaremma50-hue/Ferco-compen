"use client";

import type { LucideIcon } from "lucide-react";

export type CandidateAction = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  hidden?: boolean;
};

/**
 * Misma píldora oscura del menú flotante principal (FloatingNav) — borde de
 * 1px, fondo sólido, íconos con tooltip al pasar el mouse — para que el
 * drawer de candidato no invente un segundo lenguaje visual de botonera.
 * A diferencia del menú de navegación, acá ningún ítem queda "activo": son
 * acciones, no rutas, así que todos se muestran icono-solo con tooltip.
 */
export function CandidateActionBar({ actions }: { actions: CandidateAction[] }) {
  const visible = actions.filter((a) => !a.hidden);
  return (
    <div className="absolute inset-x-0 bottom-5 flex justify-center px-4">
      <div className="flex items-center gap-0.5 rounded-full border border-primary bg-primary p-1.5">
        {visible.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              type="button"
              aria-label={action.label}
              onClick={action.onClick}
              className="group relative flex size-11 items-center justify-center rounded-full"
            >
              <Icon
                className={`size-[17px] ${action.danger ? "text-destructive" : "text-primary-foreground/70 group-hover:text-primary-foreground"}`}
                aria-hidden
              />
              <span
                role="tooltip"
                className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
