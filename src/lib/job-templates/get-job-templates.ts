import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type { CompetencyDraft } from "./schema";

export type JobTemplate = Omit<Tables<"job_templates">, "organization_id" | "created_at" | "competencies"> & {
  competencies: CompetencyDraft[];
};

// updated_at viaja aunque la UI no la muestre — JobTemplateRow la usa como
// key para forzar que el diálogo de edición se remonte con los datos
// frescos después de guardar (defaultValue de un input no controlado solo
// aplica al montar, no se actualiza solo si el componente sigue vivo).
const COLUMNS =
  "id, name, title, country, location, work_mode, employment_type, description, requirements, pipeline_template_id, competencies, updated_at";

/** Cualquier miembro de la organización puede leerlas (RLS: job_templates_select) — se usan al solicitar una vacante, no solo al administrarlas. */
export async function getJobTemplates(organizationId: string): Promise<JobTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_templates")
    .select(COLUMNS)
    .eq("organization_id", organizationId)
    .order("name");
  return (data ?? []).map((t) => ({ ...t, competencies: (t.competencies as CompetencyDraft[]) ?? [] }));
}
