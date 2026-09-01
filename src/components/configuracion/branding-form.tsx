"use client";

import { useActionState, useEffect, useState } from "react";
import { updateBranding } from "@/lib/organizations/actions";
import { ActionButton } from "@/components/ui/action-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

const PRESET_COLORS = ["#1f4d3d", "#1b3a5c", "#6b2f2a", "#4a3f6b", "#8a5a1f"];

/**
 * El padre debe montar esto con una `key` que incluya los 4 valores que
 * llegan como prop (ver marca/page.tsx). Así, si otra pestaña guarda un
 * valor distinto y una revalidación trae ese dato fresco sin recargar la
 * página, React remonta el formulario en vez de dejar `color` o el
 * `defaultValue` de cualquier campo desactualizado con el que se montó.
 */
export function BrandingForm({
  platformName,
  accentColor,
  careersHeadline,
  careersIntro,
}: {
  platformName: string;
  accentColor: string;
  careersHeadline: string | null;
  careersIntro: string | null;
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
          className="h-[42px] rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-accent"
        />
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
            className="h-10 w-[116px] rounded-md border border-border bg-background px-3 font-mono text-sm uppercase outline-none"
          />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Se usa en botones primarios, enlaces y estados activos. Los colores de éxito, alerta y error no cambian.
        </p>
      </div>

      <div className="border-t border-border pt-5">
        <h3 className="font-serif text-lg">Bolsa pública</h3>
        <p className="mt-1 text-xs text-muted-foreground">Contenido de bienvenida en /empleos, aparte de la identidad visual.</p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="careers_headline" className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
          Título de la bolsa pública (opcional)
        </label>
        <input
          id="careers_headline"
          name="careers_headline"
          defaultValue={careersHeadline ?? ""}
          maxLength={120}
          placeholder="Vacantes abiertas"
          className="h-[42px] rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:border-accent"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="careers_intro" className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
          Texto de bienvenida en /empleos (opcional)
        </label>
        <textarea
          id="careers_intro"
          name="careers_intro"
          defaultValue={careersIntro ?? ""}
          rows={3}
          maxLength={500}
          placeholder="Cuéntale a quien visita el portal por qué vale la pena trabajar aquí…"
          className="rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:border-accent"
        />
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-5">
        <ActionButton>Guardar cambios</ActionButton>
      </div>
    </form>
  );
}
