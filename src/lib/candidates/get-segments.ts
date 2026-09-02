import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CandidateFilters } from "./get-candidates";

export type CandidateSegment = {
  id: string;
  name: string;
  filters: CandidateFilters;
};

/** Compartidos entre toda la organización (RLS: candidate_segments_select) — cualquiera puede usar el filtro guardado de otra persona, solo su autor o admin+ puede borrarlo. */
export async function getSegments(organizationId: string): Promise<CandidateSegment[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("candidate_segments")
    .select("id, name, filters")
    .eq("organization_id", organizationId)
    .order("name");
  return (data ?? []).map((s) => ({ id: s.id, name: s.name, filters: (s.filters as CandidateFilters) ?? {} }));
}
