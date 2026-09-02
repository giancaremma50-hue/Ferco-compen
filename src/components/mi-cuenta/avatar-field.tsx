"use client";

import { useActionState, useEffect, useRef } from "react";
import Image from "next/image";
import { User } from "lucide-react";
import { uploadAvatar, removeAvatar } from "@/lib/profile/actions";
import { ActionButton } from "@/components/ui/action-button";
import { DeleteButton } from "@/components/ui/delete-button";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

export function AvatarField({ currentUrl, initials }: { currentUrl: string | null; initials: string }) {
  const [state, formAction] = useActionState(uploadAvatar, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) {
      notifySuccess("Foto de perfil actualizada");
      formRef.current?.reset();
    } else if (state?.error) {
      notifyError(state.error);
    }
  }, [state]);

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-16 flex-none items-center justify-center overflow-hidden rounded-full border border-border bg-card">
        {currentUrl ? (
          <Image src={currentUrl} alt="" width={64} height={64} className="size-full object-cover" />
        ) : initials ? (
          <span className="font-serif text-lg text-muted-foreground">{initials}</span>
        ) : (
          <User className="size-6 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2">
        <form ref={formRef} action={formAction} className="flex items-center gap-2">
          <input
            type="file"
            name="file"
            accept="image/png,image/jpeg,image/webp"
            required
            className="w-full max-w-[220px] text-xs file:mr-2 file:rounded file:border file:border-border file:bg-card file:px-2 file:py-1 file:text-xs"
          />
          <ActionButton variant="secondary" className="h-8 px-3 text-xs">
            Subir
          </ActionButton>
        </form>
        {currentUrl && (
          <DeleteButton
            itemLabel="foto de perfil"
            onDelete={removeAvatar}
            successMessage="Foto de perfil eliminada"
            confirmDescription="Volverás a mostrar tus iniciales hasta que subas otra."
            className="h-8 self-start px-3 text-xs"
          />
        )}
      </div>
    </div>
  );
}
