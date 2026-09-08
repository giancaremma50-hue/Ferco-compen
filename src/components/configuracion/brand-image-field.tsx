"use client";

import { useActionState, useEffect, useRef } from "react";
import Image from "next/image";
import { ImageUp } from "lucide-react";
import { uploadBrandImage, removeBrandImage, type BrandImageField } from "@/lib/organizations/actions";
import { ActionButton } from "@/components/ui/action-button";
import { LicenseNote } from "./license-note";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

export function BrandImageField({
  field,
  label,
  hint,
  currentUrl,
  dark = false,
}: {
  field: BrandImageField;
  label: string;
  hint: string;
  currentUrl: string | null;
  dark?: boolean;
}) {
  const [state, formAction] = useActionState(uploadBrandImage, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      notifySuccess(`${label} actualizado`);
      formRef.current?.reset();
    } else if (state?.error) {
      notifyError(state.error);
    }
  }, [state, label]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">{label}</label>
      {/* flex-col en celular: miniatura+texto y el resto (subir/eliminar)
          nunca caben en una sola fila sin desbordarse — el input de archivo
          (w-32 fijo) + el botón "Subir" + el ícono de eliminar por sí solos
          ya pasan de 200px, más los 62px de la miniatura. */}
      <div
        className={`flex flex-col gap-3 rounded-md border border-dashed p-3.5 sm:flex-row sm:items-center sm:gap-3.5 ${dark ? "bg-primary" : "bg-background"}`}
      >
        <div className="flex min-w-0 items-center gap-3.5 sm:flex-1">
          <div
            className={`flex h-11 w-[62px] flex-none items-center justify-center border ${dark ? "border-primary-foreground/30" : "border-border bg-card"}`}
          >
            {currentUrl ? (
              <Image src={currentUrl} alt="" width={56} height={36} className="object-contain" />
            ) : (
              <ImageUp className="size-4 text-muted-foreground" aria-hidden />
            )}
          </div>
          <p className={`min-w-0 flex-1 text-xs leading-snug ${dark ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
            {hint}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* flex-wrap, no min-w-0/flex-1 en el input: un <input type="file">
              nativo tiene un ancho mínimo propio que el navegador no deja
              achicar por CSS por más flex-1 que se le ponga — en vez de
              pelear por encogerlo, se deja que el botón "Subir" caiga a la
              línea de abajo cuando no cabe al lado, en vez de cortarse
              contra el borde de la pantalla. */}
          <form ref={formRef} action={formAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="field" value={field} />
            <input
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp"
              required
              className="max-w-full text-xs file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-xs sm:w-32"
            />
            <ActionButton variant="secondary" className="h-8 flex-none px-3 text-xs">
              Subir
            </ActionButton>
          </form>
          {currentUrl && (
            <DeleteButton
              iconOnly
              itemLabel={label.toLowerCase()}
              onDelete={() => removeBrandImage(field)}
              successMessage={`${label} eliminado`}
              confirmDescription="Se quitará de la plataforma hasta que subas uno nuevo."
            />
          )}
        </div>
        <LicenseNote dark={dark} />
      </div>
    </div>
  );
}
