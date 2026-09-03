"use client";

import { useState } from "react";
import type { TeamMemberOption } from "@/lib/jobs/get-team-options";

/**
 * "Colaboradores adicionales" — checkboxes + un input oculto con el array de
 * ids en JSON (un <select multiple> perdería todo salvo el último valor al
 * pasar por Object.fromEntries(formData) del servidor). No excluye al
 * "Reclutador encargado" elegido en el selector de arriba — si coinciden,
 * createJob lo descarta server-side (agregar al mismo dos veces violaría el
 * UNIQUE de job_collaborators), evita sincronizar estado entre dos
 * componentes separados para un caso que no rompe nada de todos modos.
 */
export function CollaboratorsPicker({
  members,
  name = "collaborator_ids",
  emptyLabel = "No hay nadie más en la organización todavía.",
}: {
  members: TeamMemberOption[];
  /** Nombre del campo oculto — reusado también para "extra_admin_ids" en el flujo de solicitud creada por un admin. */
  name?: string;
  emptyLabel?: string;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, id] : prev.filter((existing) => existing !== id)));
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(selected)} />
      {members.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto rounded-md border border-border p-2.5">
          {members.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(m.id)}
                onChange={(e) => toggle(m.id, e.target.checked)}
                className="size-4"
              />
              {m.display_name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
