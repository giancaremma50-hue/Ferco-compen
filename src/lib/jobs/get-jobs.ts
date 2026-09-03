import "server-only";
import { createClient } from "@/lib/supabase/server";
// Única fuente de verdad para el tipo — ver JobStatusSchema en ./schema.
// Duplicarlo aquí desde Database["public"]["Enums"]["job_status"] permitía
// que ambos se desincronizaran silenciosamente si el enum de Postgres
// cambiaba sin actualizar el z.enum de validación, o viceversa.
import type { JobStatus } from "./schema";
export type { JobStatus };

export type JobListItem = {
  id: string;
  code: string;
  title: string;
  status: JobStatus;
  country: string | null;
  headcount: number;
  published_at: string | null;
};

export type JobDetail = JobListItem & {
  slug: string | null;
  location: string | null;
  work_mode: string | null;
  employment_type: string | null;
  description: string;
  requirements: string;
  salary_min: number | null;
  salary_max: number | null;
  is_public: boolean;
  department_id: string | null;
  requested_by: string | null;
  owner_id: string | null;
  ownerName: string | null;
  organization_id: string;
};

/** RLS ya decide qué filas ve este viewer — este archivo solo pide columnas. */
export async function getJobsForViewer(): Promise<JobListItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("id, code, title, status, country, headcount, published_at")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export type JobTitleOption = { id: string; title: string };

/** Para un <select> de vacante (ej. filtro de candidatos) — no necesita el resto de columnas de JobListItem. */
export async function getJobTitlesForViewer(): Promise<JobTitleOption[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("jobs").select("id, title").order("title");
  return data ?? [];
}

export async function getJobById(id: string): Promise<JobDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, code, title, status, country, headcount, published_at, slug, location, work_mode, employment_type, description, requirements, salary_min, salary_max, is_public, department_id, requested_by, owner_id, organization_id, owner:profiles!jobs_owner_id_fkey(display_name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { owner, ...job } = data;
  return { ...job, ownerName: owner?.display_name ?? null };
}
