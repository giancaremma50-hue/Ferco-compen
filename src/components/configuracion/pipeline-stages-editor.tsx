"use client";

import { useRef, useState } from "react";
import { ArrowUp, ArrowDown, X, Plus } from "lucide-react";
import { STAGE_TYPE_LABEL, type StageType } from "@/lib/pipeline-templates/schema";

type StageDraft = { name: string; type: StageType };
// `key` es solo para React (identidad estable al reordenar/quitar filas) —
// nunca viaja al servidor, ver el value del input oculto más abajo.
type StageRow = StageDraft & { key: string };

const STAGE_TYPE_OPTIONS = Object.entries(STAGE_TYPE_LABEL) as [StageType, string][];

/**
 * Estado local de la lista de etapas — el submit del formulario que lo
 * envuelve manda el array entero como JSON en un input oculto. Al guardar,
 * la Server Action borra y reinserta todas las etapas (nunca hace diff).
 */
export function PipelineStagesEditor({ initialStages }: { initialStages: StageDraft[] }) {
  // El valor inicial de un ref sí puede calcularse desde props en la misma
  // línea (solo se usa en el primer render) — lo que no vale es LEER un
  // ref dentro de un inicializador perezoso de useState. Por eso las keys
  // iniciales usan el índice del array semilla, no el ref; el ref solo se
  // toca en addStage, un event handler.
  const seedLength = initialStages.length > 0 ? initialStages.length : 1;
  const nextKey = useRef(seedLength);
  const [stages, setStages] = useState<StageRow[]>(() => {
    const seed = initialStages.length > 0 ? initialStages : [{ name: "Postulado", type: "postulado" as StageType }];
    return seed.map((s, i) => ({ ...s, key: `stage-${i}` }));
  });

  function updateStage(index: number, patch: Partial<StageDraft>) {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeStage(index: number) {
    setStages((prev) => prev.filter((_, i) => i !== index));
  }

  function moveStage(index: number, direction: -1 | 1) {
    setStages((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addStage() {
    setStages((prev) => [...prev, { name: "", type: "preseleccion", key: `stage-${nextKey.current++}` }]);
  }

  return (
    <div>
      <input
        type="hidden"
        name="stages"
        value={JSON.stringify(stages.map(({ name, type }) => ({ name, type })))}
      />
      <div className="flex flex-col gap-2.5">
        {stages.map((stage, i) => (
          <div key={stage.key} className="flex items-center gap-2">
            <span className="w-5 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
            <input
              value={stage.name}
              onChange={(e) => updateStage(i, { name: e.target.value })}
              placeholder="Nombre de la etapa"
              className="h-9 flex-1 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
            />
            <select
              value={stage.type}
              onChange={(e) => updateStage(i, { type: e.target.value as StageType })}
              className="h-9 w-40 rounded-md border border-border bg-background px-2 text-sm"
            >
              {STAGE_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => moveStage(i, -1)}
              disabled={i === 0}
              aria-label="Mover arriba"
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground disabled:opacity-30"
            >
              <ArrowUp className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => moveStage(i, 1)}
              disabled={i === stages.length - 1}
              aria-label="Mover abajo"
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground disabled:opacity-30"
            >
              <ArrowDown className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => removeStage(i)}
              disabled={stages.length === 1}
              aria-label="Quitar etapa"
              className="flex size-8 items-center justify-center rounded-md border border-destructive text-destructive disabled:opacity-30"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addStage}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent"
      >
        <Plus className="size-4" aria-hidden />
        Agregar etapa
      </button>
    </div>
  );
}
