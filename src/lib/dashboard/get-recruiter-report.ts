import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/lib/jobs/get-jobs";

const STALE_DAYS = 14;

export type RecruiterRow = {
  ownerId: string | null;
  ownerName: string;
  jobsByStatus: Partial<Record<JobStatus, number>>;
  totalApplications: number;
  hires: number;
  conversionRate: number | null;
  avgDaysToHire: number | null;
};

export type StaleJob = { id: string; title: string; ownerName: string; daysSinceMovement: number };

export type RecruiterReport = { rows: RecruiterRow[]; staleJobs: StaleJob[] };

/**
 * Solo para admin/super_admin (impuesto por el caller, no por RLS aparte —
 * `jobs_select_internal`/`applications_select` ya le dan a este rol
 * visibilidad de toda la organización; un gestor que llamara esto vería
 * únicamente sus propias vacantes, sin fuga, pero el informe no tendría
 * sentido para él, así que la pantalla no se lo ofrece).
 *
 * Igual que get-funnel.ts: sin tabla de reportería ni vista materializada —
 * se trae `jobs`+`applications` y se agrupa en memoria, mismo patrón que
 * el resto del proyecto (getKanbanData, getDrawerData).
 *
 * ponytail: `jobs` se acota a las 300 más recientes (orden por creación) en
 * vez de traer el historial completo de la organización sin límite — a este
 * volumen la agregación en memoria es barata y de sobra para cualquier
 * cliente real por años. Si algún día se necesita más, el arreglo correcto
 * es un `group by` en SQL, no subir este número. `applications` se acota a
 * las de esos mismos jobs, no a toda la organización.
 */
const JOBS_LOOKBACK_LIMIT = 300;

export async function getRecruiterReport(): Promise<RecruiterReport> {
  const supabase = await createClient();

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, title, status, owner_id, published_at, owner:profiles!jobs_owner_id_fkey(display_name)")
    .order("created_at", { ascending: false })
    .limit(JOBS_LOOKBACK_LIMIT);

  // .in() con lista vacía es una consulta válida (siempre 0 filas) — más
  // simple que ramificar por jobIds.length y evita que el tipo de `apps`
  // dependa de cuál rama corrió.
  const jobIds = (jobs ?? []).map((j) => j.id);
  const { data: apps } = await supabase
    .from("applications")
    .select("id, job_id, status, applied_at, updated_at, stage_changed_at")
    .in("job_id", jobIds);

  const appsByJob = new Map<string, NonNullable<typeof apps>>();
  for (const app of apps ?? []) {
    const list = appsByJob.get(app.job_id) ?? [];
    list.push(app);
    appsByJob.set(app.job_id, list);
  }

  type Acc = { ownerName: string; jobsByStatus: Partial<Record<JobStatus, number>>; total: number; hires: number; hireDaysSum: number };
  const byOwner = new Map<string, Acc>();
  const staleJobs: StaleJob[] = [];
  const now = Date.now();

  for (const job of jobs ?? []) {
    const key = job.owner_id ?? "sin-encargado";
    const ownerName = job.owner?.display_name ?? "Sin encargado";
    const acc = byOwner.get(key) ?? { ownerName, jobsByStatus: {}, total: 0, hires: 0, hireDaysSum: 0 };
    acc.jobsByStatus[job.status] = (acc.jobsByStatus[job.status] ?? 0) + 1;

    const jobApps = appsByJob.get(job.id) ?? [];
    acc.total += jobApps.length;
    for (const app of jobApps) {
      if (app.status === "contratada") {
        acc.hires += 1;
        acc.hireDaysSum += (new Date(app.updated_at).getTime() - new Date(app.applied_at).getTime()) / 86_400_000;
      }
    }
    byOwner.set(key, acc);

    if (job.status === "abierta") {
      const activeMovements = jobApps.filter((a) => a.status === "activa").map((a) => new Date(a.stage_changed_at).getTime());
      const lastMovement = activeMovements.length > 0 ? Math.max(...activeMovements) : job.published_at ? new Date(job.published_at).getTime() : now;
      const daysSince = Math.floor((now - lastMovement) / 86_400_000);
      if (daysSince >= STALE_DAYS) staleJobs.push({ id: job.id, title: job.title, ownerName, daysSinceMovement: daysSince });
    }
  }

  const rows: RecruiterRow[] = Array.from(byOwner.entries()).map(([ownerId, acc]) => ({
    ownerId: ownerId === "sin-encargado" ? null : ownerId,
    ownerName: acc.ownerName,
    jobsByStatus: acc.jobsByStatus,
    totalApplications: acc.total,
    hires: acc.hires,
    conversionRate: acc.total === 0 ? null : Math.round((acc.hires / acc.total) * 100),
    avgDaysToHire: acc.hires === 0 ? null : Math.round(acc.hireDaysSum / acc.hires),
  }));
  rows.sort((a, b) => b.totalApplications - a.totalApplications);
  staleJobs.sort((a, b) => b.daysSinceMovement - a.daysSinceMovement);

  return { rows, staleJobs };
}
