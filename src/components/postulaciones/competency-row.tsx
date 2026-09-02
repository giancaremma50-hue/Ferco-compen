"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { submitScore } from "@/lib/competencies/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { SCORE_MAX } from "@/lib/competencies/schema";
import type { CompetencyEvaluation } from "@/lib/competencies/get-competencies";

export function CompetencyRow({ applicationId, evaluation }: { applicationId: string; evaluation: CompetencyEvaluation }) {
  const [score, setScore] = useState(evaluation.myScore?.score ?? 0);
  const lastSavedScore = useRef(evaluation.myScore?.score ?? 0);
  const action = submitScore.bind(null, applicationId, evaluation.competencyId);
  const [state, formAction, isPending] = useActionState(action, undefined);

  useEffect(() => {
    if (state?.error) {
      // Revierte a lo último realmente guardado — sin esto, la fila queda
      // mostrando una calificación que nunca se persistió (mismo patrón
      // de RatingStars).
      setScore(lastSavedScore.current);
      notifyError(state.error);
    } else if (state?.success) {
      lastSavedScore.current = score;
      notifySuccess(state.success);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const others = evaluation.scores.filter((s) => s.evaluatorId !== evaluation.myScore?.evaluatorId);

  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{evaluation.competencyName}</p>
          <p className="text-xs tabular-nums text-muted-foreground">Peso {evaluation.weight}</p>
        </div>
        {evaluation.average !== null && (
          <p className="font-serif text-[22px] tabular-nums">{evaluation.average.toFixed(1)}</p>
        )}
      </div>

      <form action={formAction} className="mt-3 flex items-end gap-3">
        <input type="hidden" name="score" value={score} />
        <div className="flex items-center gap-1" aria-busy={isPending}>
          {Array.from({ length: SCORE_MAX }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              disabled={isPending}
              onClick={() => setScore(n === score ? 0 : n)}
              aria-label={`Calificar con ${n} de ${SCORE_MAX}`}
              className="disabled:opacity-50"
            >
              <Star className={`size-5 ${n <= score ? "fill-foreground text-foreground" : "text-border"}`} aria-hidden />
            </button>
          ))}
        </div>
        <input
          name="comment"
          defaultValue={evaluation.myScore?.comment ?? ""}
          disabled={isPending}
          placeholder="Comentario (opcional)"
          maxLength={500}
          className="h-9 flex-1 rounded-md border border-border bg-background px-2.5 text-xs outline-none focus:border-foreground disabled:opacity-50"
        />
        <ActionButton type="submit" className="h-9 px-3 text-xs" pendingLabel="Guardando…" disabled={score === 0}>
          Guardar
        </ActionButton>
      </form>

      {others.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-border/60 pt-3">
          {others.map((s) => (
            <li key={s.evaluatorId} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{s.evaluatorName}</span> ·{" "}
              <span className="tabular-nums">
                {s.score}/{SCORE_MAX}
              </span>
              {s.comment && <> — {s.comment}</>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
