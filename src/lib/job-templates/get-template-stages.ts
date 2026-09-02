import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TemplateStageDraft } from "./wizard-schema";

/**
 * Solo las etapas del MEDIO — "Bandeja de entrada"/"Contratado"/"Descartado"
 * son fijas (el servidor las arma siempre igual, ver updateTemplateStep4),
 * no tiene sentido devolverlas para prellenar un editor que no las muestra.
 */
export async function getTemplateStages(templateId: string): Promise<TemplateStageDraft[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_template_stages")
    .select("title, type")
    .eq("job_template_id", templateId)
    .not("type", "in", "(postulado,contratado,descartado)")
    .order("position");

  return (data ?? []) as TemplateStageDraft[];
}
