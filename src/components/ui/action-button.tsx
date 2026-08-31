"use client";

import { forwardRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground border-primary hover:opacity-90",
  secondary: "bg-card text-foreground border-border hover:bg-muted",
  ghost: "bg-transparent text-muted-foreground border-transparent hover:bg-muted",
  destructive: "bg-destructive text-destructive-foreground border-destructive hover:opacity-90",
};

/**
 * Todo botón que muta datos usa este componente — regla no negociable.
 * Cuando vive dentro de un <form action={serverAction}>, el estado de
 * carga sale de useFormStatus() y no hay que pasarlo a mano.
 */
export const ActionButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: Variant;
    pending?: boolean;
    pendingLabel?: string;
  }
>(function ActionButton(
  { variant = "primary", pending, pendingLabel, className, children, disabled, type = "submit", ...props },
  ref,
) {
  const formStatus = useFormStatus();
  const isPending = pending ?? formStatus.pending;

  return (
    <button
      ref={ref}
      type={type}
      aria-busy={isPending}
      disabled={disabled || isPending}
      className={cn(
        "inline-flex h-[42px] items-center justify-center gap-2 rounded-md border px-5 text-sm font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    >
      {isPending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
});
