"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/** Para publicar en bolsas externas (LinkedIn, Computrabajo, etc.) con los métodos que la organización ya use hoy. */
export function CopyJobLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso del navegador para el portapapeles — el link ya está
      // visible en el input de al lado, seleccionable a mano.
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.target.select()}
        className="h-9 flex-1 truncate rounded-md border border-border bg-background px-2.5 text-xs text-muted-foreground outline-none"
      />
      <button
        type="button"
        onClick={handleCopy}
        className="flex h-9 flex-none items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium"
      >
        {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
