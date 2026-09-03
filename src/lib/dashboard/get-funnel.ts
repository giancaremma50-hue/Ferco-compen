import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { getOrgMonthStart } from "./org-clock";

type StageType = Database["public"]["Enums"]["job_stage_type"];

export const STAGE_TYPE_ORDER: StageType[] = ["postulado", "preseleccion", "entrevista", "oferta", "contratado"];
export const STAGE_TYPE_LABEL: Record<StageType, string> = {
  postulado: "Postulado",
  preseleccion: "Preselección",
  entrevista: "Entrevista",
  oferta: "Oferta",
  contratado: "Contratado",
  descartado: "Descartado",
};

export type FunnelData = {
  openJobs: number;
  activeCandidates: number;
  hiresThisMonth: number;
  avgDaysToHire: number | null;
  byStageType: { type: StageType; label: string; count: number }[];
};

/**
 * Todo lo que ve este viewer, ni más — cada query aquí lee `jobs`/`applications`
 * tal cual, sin filtro de alcance propio: RLS (`jobs_select_internal`,
 * `applications_select`) ya decide qué filas llegan según el rol (admin ve la
 * organización completa, gestor solo lo suyo). No hay parámetro de rol en esta
 * función a propósito — pedirlo invitaría a "confiar" en lo que mande el
 * cliente en vez de en lo que la base de datos ya filtró.
 *
 * `avgDaysToHire`/`hiresThisMonth` son una aproximación: `applications` no
 * guarda cuándo pasó a "contratada" (no hay evento ni columna para eso), así
 * que se usa `updated_at` de la fila como sustituto. Es preciso casi siempre
 * (poco se toca una postulación después de contratada), pero no está
 * garantizado — la fecha exacta necesitaría una columna nueva o un evento de
 * "contratada" en application_events, pendiente de decidir con el resto de
 * las migraciones de este paquete.
 *
 * `activeCandidates`/`byStageType` excluyen a propósito las postulaciones
 * que están en una etapa de tipo `descartado` aunque su `status` siga
 * `"activa"` — moveApplicationStage() solo cambia `stage_id`, nunca
 * `status` (rechazar de verdad usa rejectApplication, con motivo), así que
 * arrastrar una tarjeta a la columna "Descartado" del kanban deja la
 * postulación activa pero fuera del embudo hacia adelante. Sin este
 * filtro, "Candidatos activos" y la suma de las barras del embudo
 * mostrarían números distintos para la misma cifra.
 */
export async function getFunnelData(): Promise<FunnelData> {
  const supabase = await createClient();
  const monthStart = getOrgMonthStart();

  const [{ count: openJobs }, { data: activeAppsRaw }, { data: hiredApps }] = await Promise.all([
    supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "abierta"),
    supabase.from("applications").select("id, applied_at, job_stages(type)").eq("status", "activa"),
    supabase
      .from("applications")
      .select("applied_at, updated_at")
      .eq("status", "contratada")
      .gte("updated_at", monthStart.toISOString()),
  ]);

  const activeApps = (activeAppsRaw ?? []).filter((app) => app.job_stages?.type !== "descartado");

  const byStageTypeCount = new Map<StageType, number>();
  for (const app of activeApps) {
    const type = app.job_stages?.type;
    if (!type) continue;
    byStageTypeCount.set(type, (byStageTypeCount.get(type) ?? 0) + 1);
  }

  const hires = hiredApps ?? [];
  const avgDaysToHire =
    hires.length === 0
      ? null
      : Math.round(
          hires.reduce((sum, a) => sum + (new Date(a.updated_at).getTime() - new Date(a.applied_at).getTime()), 0) /
            hires.length /
            86_400_000,
        );

  return {
    openJobs: openJobs ?? 0,
    activeCandidates: activeApps.length,
    hiresThisMonth: hires.length,
    avgDaysToHire,
    byStageType: STAGE_TYPE_ORDER.map((type) => ({ type, label: STAGE_TYPE_LABEL[type], count: byStageTypeCount.get(type) ?? 0 })),
  };
}
