"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import type { CompetencyDraft } from "@/lib/job-templates/schema";

// `key` es solo para React (identidad estable al quitar filas) — nunca
// viaja al servidor, ver el value del input oculto más abajo.
type CompetencyRow = CompetencyDraft & { key: string };

export type CompetencyListEditorHandle = { clear: () => void };

/**
 * Rúbrica opcional de la plantilla — mismo patrón que PipelineStagesEditor:
 * estado local, el submit manda el array entero como JSON en un input
 * oculto, la Server Action reemplaza `competencies` completo (nunca hace
 * diff). A diferencia de las etapas, puede quedar vacía — no toda plantilla
 * necesita una rúbrica de evaluación.
 *
 * `ref.clear()`: a diferencia de los <input> del resto del diálogo, esta
 * lista vive en estado de React, no en el DOM — formRef.reset() del padre
 * no la toca. El padre llama a esto tras crear una plantilla con éxito,
 * para que "Nueva plantilla" no reabra mostrando la rúbrica de la anterior.
 */
export const CompetencyListEditor = forwardRef<CompetencyListEditorHandle, { initialCompetencies: CompetencyDraft[] }>(
  function CompetencyListEditor({ initialCompetencies }, ref) {
    const nextKey = useRef(initialCompetencies.length);
    const [rows, setRows] = useState<CompetencyRow[]>(() =>
      initialCompetencies.map((c, i) => ({ ...c, key: `competency-${i}` })),
    );

    useImperativeHandle(ref, () => ({ clear: () => setRows([]) }));

    function updateRow(index: number, patch: Partial<CompetencyDraft>) {
      setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    }

    function removeRow(index: number) {
      setRows((prev) => prev.filter((_, i) => i !== index));
    }

    function addRow() {
      setRows((prev) => [...prev, { name: "", weight: 0, key: `competency-${nextKey.current++}` }]);
    }

    return (
      <div>
        <input type="hidden" name="competencies" value={JSON.stringify(rows.map(({ name, weight }) => ({ name, weight })))} />
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin competencias — la vacante creada desde esta plantilla no traerá ninguna.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div key={row.key} className="flex items-center gap-2">
                <input
                  value={row.name}
                  onChange={(e) => updateRow(i, { name: e.target.value })}
                  placeholder="Nombre de la competencia"
                  className="h-9 flex-1 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={row.weight}
                  onChange={(e) => updateRow(i, { weight: Number(e.target.value) })}
                  placeholder="Peso"
                  className="h-9 w-20 rounded-md border border-border bg-background px-2 text-sm tabular-nums outline-none focus:border-foreground"
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label="Quitar competencia"
                  className="flex size-8 flex-none items-center justify-center rounded-md border border-destructive text-destructive"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        )}
        <button type="button" onClick={addRow} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
          <Plus className="size-4" aria-hidden />
          Agregar competencia
        </button>
      </div>
    );
  },
);
