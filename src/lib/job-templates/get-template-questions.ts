import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { QuestionDraft } from "./wizard-schema";

/** Preguntas + opciones de una plantilla, en el orden guardado — para prellenar el editor del paso 3. */
export async function getTemplateQuestions(templateId: string): Promise<QuestionDraft[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_template_questions")
    .select("prompt, type, job_template_question_options(label, is_expected)")
    .eq("job_template_id", templateId)
    .order("position")
    .order("position", { referencedTable: "job_template_question_options" });

  return (data ?? []).map((q) => ({
    prompt: q.prompt,
    type: q.type as QuestionDraft["type"],
    options: (q.job_template_question_options ?? []).map((o) => ({ label: o.label, is_expected: o.is_expected })),
  }));
}
