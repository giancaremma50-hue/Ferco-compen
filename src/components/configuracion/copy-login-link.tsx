"use client";

import { Copy } from "lucide-react";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";

export function CopyLoginLink({ url }: { url: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          notifySuccess("Enlace copiado");
        } catch {
          notifyError("No se pudo copiar", "Copia el enlace manualmente: " + url);
        }
      }}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3.5 text-xs font-medium text-foreground"
    >
      <Copy className="size-3.5" aria-hidden />
      Copiar enlace de acceso
    </button>
  );
}
