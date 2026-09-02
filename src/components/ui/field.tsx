import { cloneElement, isValidElement, type ReactElement } from "react";
import { cn } from "@/lib/utils";

type Control = ReactElement<{ className?: string; "aria-invalid"?: boolean; id?: string }>;

/**
 * Envoltorio compartido de campo de formulario: cuando `error` viene con
 * texto, resalta el control en rojo (borde + mensaje debajo) en vez de
 * dejar que el único indicio sea un toast genérico — así se sabe DE UN
 * VISTAZO cuál campo hay que corregir, no solo que "algo" falló.
 */
export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: Control;
}) {
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        "aria-invalid": !!error,
        className: cn(children.props.className, error && "border-destructive focus-visible:border-destructive"),
      })
    : children;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
        {label}
      </label>
      {control}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
