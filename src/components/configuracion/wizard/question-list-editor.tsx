"use client";

import { useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import type { QuestionDraft, QuestionOptionDraft } from "@/lib/job-templates/wizard-schema";

// `key` es solo para React (identidad estable al reordenar/quitar filas en
// dos niveles) — nunca viaja al servidor, ver el value del input oculto.
type OptionRow = QuestionOptionDraft & { key: string };
type QuestionRow = Omit<QuestionDraft, "options"> & { options: OptionRow[]; key: string };

/**
 * Banco de preguntas del paso 3 — mismo patrón "estado local + input oculto
 * con el array entero" que CompetencyListEditor/PipelineStagesEditor, pero
 * con dos niveles (cada pregunta de opción múltiple lleva su propia lista
 * de opciones). El submit manda todo como un solo JSON; la Server Action
 * reemplaza la lista completa, nunca hace diff.
 */
export function QuestionListEditor({ initialQuestions }: { initialQuestions: QuestionDraft[] }) {
  const nextQuestionKey = useRef(initialQuestions.length);
  const nextOptionKey = useRef(initialQuestions.reduce((sum, q) => sum + q.options.length, 0));
  const [questions, setQuestions] = useState<QuestionRow[]>(() =>
    initialQuestions.map((q, i) => ({
      ...q,
      key: `question-${i}`,
      options: q.options.map((o, j) => ({ ...o, key: `option-${i}-${j}` })),
    })),
  );

  function updateQuestion(index: number, patch: Partial<Omit<QuestionRow, "key">>) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, { prompt: "", type: "open", options: [], key: `question-${nextQuestionKey.current++}` }]);
  }

  function addOption(questionIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === questionIndex
          ? { ...q, options: [...q.options, { label: "", is_expected: false, key: `option-${nextOptionKey.current++}` }] }
          : q,
      ),
    );
  }

  function updateOption(questionIndex: number, optionIndex: number, patch: Partial<QuestionOptionDraft>) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === questionIndex ? { ...q, options: q.options.map((o, j) => (j === optionIndex ? { ...o, ...patch } : o)) } : q,
      ),
    );
  }

  function removeOption(questionIndex: number, optionIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === questionIndex ? { ...q, options: q.options.filter((_, j) => j !== optionIndex) } : q)),
    );
  }

  return (
    <div>
      <input
        type="hidden"
        name="questions"
        value={JSON.stringify(
          questions.map(({ prompt, type, options }) => ({
            prompt,
            type,
            options: options.map(({ label, is_expected }) => ({ label, is_expected })),
          })),
        )}
      />
      {questions.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin preguntas — la vacante creada desde esta plantilla no pedirá ninguna.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((question, i) => (
            <div key={question.key} className="rounded-md border border-border p-3">
              <div className="flex items-start gap-2">
                <input
                  value={question.prompt}
                  onChange={(e) => updateQuestion(i, { prompt: e.target.value })}
                  placeholder="Escribe la pregunta"
                  className="h-9 flex-1 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-foreground"
                />
                <select
                  data-tour="w3-tipo"
                  value={question.type}
                  onChange={(e) => {
                    const type = e.target.value as QuestionDraft["type"];
                    // Las opciones de una pregunta de opción múltiple no
                    // tienen sentido (ni se muestran) si pasa a ser
                    // abierta — se limpian acá para que no queden filas
                    // huérfanas invisibles esperando a reinsertarse en cada
                    // guardado (el servidor también las filtra, ver
                    // updateTemplateStep3 — esto es solo higiene del lado
                    // del cliente, no la barrera real).
                    updateQuestion(i, { type, options: type === "multiple_choice" ? question.options : [] });
                  }}
                  className="h-9 w-40 rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="open">Abierta</option>
                  <option value="multiple_choice">Opción múltiple</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeQuestion(i)}
                  aria-label="Quitar pregunta"
                  className="flex size-9 flex-none items-center justify-center rounded-md border border-destructive text-destructive"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>

              {question.type === "multiple_choice" && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border/60 pt-3 pl-1">
                  {question.options.map((option, j) => (
                    <div key={option.key} className="flex items-center gap-2">
                      <input
                        value={option.label}
                        onChange={(e) => updateOption(i, j, { label: e.target.value })}
                        placeholder="Texto de la opción"
                        className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-foreground"
                      />
                      <label className="flex flex-none items-center gap-1.5 text-xs text-muted-foreground" data-tour="w3-esperada">
                        <input
                          type="checkbox"
                          checked={option.is_expected}
                          onChange={(e) => updateOption(i, j, { is_expected: e.target.checked })}
                        />
                        Esperada
                      </label>
                      <button
                        type="button"
                        onClick={() => removeOption(i, j)}
                        aria-label="Quitar opción"
                        className="flex size-7 flex-none items-center justify-center rounded-md border border-destructive text-destructive"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addOption(i)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-accent"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Agregar opción
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={addQuestion} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
        <Plus className="size-4" aria-hidden />
        Agregar pregunta
      </button>
    </div>
  );
}
