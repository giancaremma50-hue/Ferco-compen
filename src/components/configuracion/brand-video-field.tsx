"use client";

import { useRef, useState } from "react";
import { Video } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createBrandVideoUploadUrl,
  confirmBrandVideoUpload,
  removeBrandVideo,
  type BrandVideoField,
} from "@/lib/organizations/actions";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["video/mp4", "video/webm"]);

/**
 * Sube el archivo directo del navegador a Supabase Storage con una URL
 * firmada — no pasa por ninguna Server Action de Next, así que no choca con
 * el límite de tamaño de body de las funciones de Vercel (~4.5 MB). El
 * servidor solo autoriza la ruta (createBrandVideoUploadUrl) y confirma
 * después de que el archivo ya está en Storage (confirmBrandVideoUpload).
 */
export function BrandVideoField({
  field,
  label,
  hint,
  currentUrl,
}: {
  field: BrandVideoField;
  label: string;
  hint: string;
  currentUrl: string | null;
}) {
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.has(file.type)) {
      notifyError("Formato no admitido. Usa MP4 o WebM.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      notifyError("El video pesa más de 20 MB. Usa uno más corto o comprímelo.");
      e.target.value = "";
      return;
    }

    setPending(true);
    try {
      const prepared = await createBrandVideoUploadUrl(field, file.type, file.size);
      if (!prepared.ok) {
        notifyError(prepared.error);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("marca-publico")
        .uploadToSignedUrl(prepared.path, prepared.token, file, { contentType: file.type });
      if (uploadError) {
        notifyError("No se pudo subir el video. Inténtalo de nuevo.");
        return;
      }

      const confirmed = await confirmBrandVideoUpload(field, prepared.path);
      if (confirmed?.error) {
        notifyError(confirmed.error);
        return;
      }
      notifySuccess(`${label} actualizado`);
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">{label}</label>
      <div className="flex items-center gap-3.5 rounded-md border border-dashed bg-background p-3.5">
        <div className="flex h-11 w-[62px] flex-none items-center justify-center border border-border bg-card">
          <Video className="size-4 text-muted-foreground" aria-hidden />
        </div>
        <p className="flex-1 text-xs leading-snug text-muted-foreground">{hint}</p>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm"
            onChange={handleUpload}
            disabled={pending}
            className="w-32 text-xs file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-xs"
          />
          {pending && <span className="text-xs text-muted-foreground">Subiendo…</span>}
        </div>
        {currentUrl && (
          <DeleteButton
            iconOnly
            itemLabel={label.toLowerCase()}
            onDelete={() => removeBrandVideo(field)}
            successMessage={`${label} eliminado`}
            confirmDescription="Se quitará de la plataforma hasta que subas otro."
          />
        )}
      </div>
    </div>
  );
}
