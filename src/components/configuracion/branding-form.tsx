"use client";

import { useActionState, useEffect, useState } from "react";
import { updateBranding } from "@/lib/organizations/actions";
import { ActionButton } from "@/components/ui/action-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

const PRESET_COLORS = ["#1f4d3d", "#1b3a5c", "#6b2f2a", "#4a3f6b", "#8a5a1f"];

/**
 * El padre debe montar esto con `key={`${platformName}-${accentColor}`}`
 * (ver marca/page.tsx). Así, si otra pestaña guarda un valor distinto y una
 * revalidación trae ese dato fresco sin recargar la página, React remonta
 * el formulario en vez de dejar `color` o el `defaultValue` del nombre
 * desactualizados con los que se montó.
 */
export function BrandingForm({
  platformName,
  accentColor,
}: {
  platformName: string;
  accentColor: string;
}) {
  const [state, formAction] = useActionState(updateBranding, undefined);
  const [color, setColor] = useState(accentColor);

  useEffect(() => {
    if (state?.success) notifySuccess(state.success);
    else if (state?.error) notifyError(state.error);
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="platform_name" className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
          Nombre de la plataforma
        </label>
        <input
          id="platform_name"
          name="platform_name"
          defaultValue={platformName}
          maxLength={60}
          required
          aria-invalid={state?.field === "platform_name"}
          className={`h-[42px] rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-accent ${state?.field === "platform_name" ? "border-destructive" : "border-border"}`}
        />
        {state?.field === "platform_name" && <p className="text-xs text-destructive">{state.error}</p>}
      </div>

      <div className="flex flex-col gap-2.5">
        <label className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Color de acento</label>
        <div className="flex items-center gap-2.5">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setColor(preset)}
              aria-label={`Usar ${preset}`}
              style={{ backgroundColor: preset }}
              className={`size-10 rounded-md border-2 ${color === preset ? "border-foreground outline outline-1 outline-offset-2 outline-foreground" : "border-border"}`}
            />
          ))}
          <input
            name="accent_color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            pattern="^#[0-9a-fA-F]{6}$"
            required
            aria-invalid={state?.field === "accent_color"}
            className={`h-10 w-[116px] rounded-md border bg-background px-3 font-mono text-sm uppercase outline-none ${state?.field === "accent_color" ? "border-destructive" : "border-border"}`}
          />
        </div>
        {state?.field === "accent_color" ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Se usa en botones primarios, enlaces y estados activos. Los colores de éxito, alerta y error no cambian.
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-5">
        <ActionButton>Guardar cambios</ActionButton>
      </div>
    </form>
  );
}
