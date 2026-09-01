"use client";

import { useRouter } from "next/navigation";

export function TemplatePicker({
  templates,
  selectedId,
}: {
  templates: { id: string; name: string }[];
  selectedId?: string;
}) {
  const router = useRouter();

  if (templates.length === 0) return null;

  return (
    <label className="flex flex-col gap-2">
      <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Empezar desde una plantilla (opcional)</span>
      <select
        // key: sin esto, un "atrás" del navegador cambia selectedId pero
        // este <select> no controlado no se entera (defaultValue solo
        // aplica al montar) y se queda mostrando la plantilla vieja.
        key={selectedId ?? "blank"}
        defaultValue={selectedId ?? ""}
        onChange={(e) => router.push(e.target.value ? `/vacantes/nueva?template=${e.target.value}` : "/vacantes/nueva")}
        className="h-11 rounded-md border border-border bg-background px-3 text-sm"
      >
        <option value="">En blanco</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
