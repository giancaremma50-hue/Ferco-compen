import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { JobStatus } from "@/lib/jobs/get-jobs";

export type PendingRequest = {
  id: string;
  title: string;
  code: string;
  requestedByName: string | null;
  departmentName: string | null;
  createdAt: string;
};

/**
 * Buzón de RH: solicitudes esperando resolución. `jobs_select_internal` (RLS)
 * ya deja ver toda la organización a admin/super_admin — este query solo
 * agrega el filtro de estado, no de alcance.
 *
 * Flujo de hoy (aprobar = publicar en un solo paso, `approveAndPublish`) —
 * cuando exista el estado `aceptada` (fase 2 del plan), este query y las
 * acciones que dispara el botón cambian a aceptar/devolver en vez de
 * aprobar/publicar directo.
 */
export async function getPendingApprovals(): Promise<PendingRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select(
      "id, title, code, created_at, requester:profiles!jobs_requested_by_fkey(display_name), department:departments(name)",
    )
    .eq("status", "pendiente_aprobacion")
    .order("created_at")
    .limit(50);

  return (data ?? []).map((j) => ({
    id: j.id,
    title: j.title,
    code: j.code,
    requestedByName: j.requester?.display_name ?? null,
    departmentName: j.department?.name ?? null,
    createdAt: j.created_at,
  }));
}

export type MyRequest = {
  id: string;
  title: string;
  code: string;
  status: JobStatus;
  createdAt: string;
};

/** Gestor: en qué va lo que él mismo pidió — filtrado explícito por requested_by, no solo por lo que RLS deja pasar (que también incluiría vacantes donde es colaborador). */
export async function getMyRequests(profileId: string): Promise<MyRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("jobs")
    .select("id, title, code, status, created_at")
    .eq("requested_by", profileId)
    .order("created_at", { ascending: false })
    .limit(8);
  return (data ?? []).map((j) => ({ id: j.id, title: j.title, code: j.code, status: j.status, createdAt: j.created_at }));
}
