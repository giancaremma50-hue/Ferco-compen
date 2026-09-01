import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type TableWithOrg = "departments" | "pipeline_templates" | "employment_reasons";

/**
 * "Un id hijo no prueba pertenencia al padre correcto" — un <select> ya
 * filtrado en el cliente no es garantía server-side, una Server Action es
 * un endpoint de red y nada impide un POST fabricado a mano con el id de
 * otra organización. Extraído al cruzar el umbral de 3-4 copias
 * documentado en napkin.md (Fase 9) — antes vivía repetido como
 * assertValidDepartment (jobs/actions.ts, job-templates/wizard-actions.ts),
 * assertValidPipelineTemplate (job-templates/actions.ts) y
 * assertValidEmploymentReason (jobs/actions.ts).
 */
export async function assertBelongsToOrg(
  supabase: SupabaseClient<Database>,
  table: TableWithOrg,
  id: string | undefined,
  organizationId: string,
  notFoundMessage: string,
): Promise<string | null> {
  if (!id) return null;
  const { data } = await supabase.from(table).select("id").eq("id", id).eq("organization_id", organizationId).maybeSingle();
  return data ? null : notFoundMessage;
}
