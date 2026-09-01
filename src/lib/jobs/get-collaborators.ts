import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type JobCollaboratorRow = Tables<"job_collaborators"> & {
  profile: { display_name: string; email: string; role: string } | null;
};

export async function getJobCollaborators(jobId: string): Promise<JobCollaboratorRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_collaborators")
    .select("*, profile:profiles!job_collaborators_profile_id_fkey(display_name, email, role)")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });
  return (data as JobCollaboratorRow[]) ?? [];
}

export type AddableProfile = { id: string; display_name: string; email: string };

/** Gente de la organización que todavía no es colaboradora de ESTA vacante — para el selector de "agregar". */
export async function getAddableProfiles(jobId: string, organizationId: string): Promise<AddableProfile[]> {
  const supabase = await createClient();
  const [{ data: profiles }, { data: existing }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, email")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("display_name"),
    supabase.from("job_collaborators").select("profile_id").eq("job_id", jobId),
  ]);
  const existingIds = new Set((existing ?? []).map((e) => e.profile_id));
  return (profiles ?? []).filter((p) => !existingIds.has(p.id));
}
