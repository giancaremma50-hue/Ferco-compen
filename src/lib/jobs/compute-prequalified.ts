export type MultipleChoiceQuestion = { id: string; options: { id: string; is_expected: boolean }[] };
export type AnsweredOption = { job_question_id: string; selected_option_id: string | null };

/**
 * `null` — la vacante no tiene preguntas de opción múltiple, o el candidato
 * no respondió ninguna (dato insuficiente, no lo mismo que "no calificó").
 * `true`/`false` — de las preguntas de opción múltiple que sí respondió,
 * si TODAS coinciden con la opción marcada como esperada al configurar la
 * plantilla. Las que dejó sin responder no cuentan ni a favor ni en contra
 * — las preguntas son opcionales de responder, no se penaliza saltarlas.
 */
export function computePrequalified(
  multipleChoiceQuestions: MultipleChoiceQuestion[],
  answers: AnsweredOption[],
): boolean | null {
  const relevant = answers.filter((a) => multipleChoiceQuestions.some((q) => q.id === a.job_question_id));
  if (relevant.length === 0) return null;

  return relevant.every((a) => {
    const question = multipleChoiceQuestions.find((q) => q.id === a.job_question_id);
    const option = question?.options.find((o) => o.id === a.selected_option_id);
    return option?.is_expected === true;
  });
}
