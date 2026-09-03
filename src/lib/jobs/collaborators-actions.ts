"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { AddCollaboratorSchema } from "./collaborators-schema";

export type CollaboratorActionResult = { error?: string; success?: string };

export async function addJobCollaborator(
  jobId: string,
  _prevState: CollaboratorActionResult | undefined,
  formData: FormData,
): Promise<CollaboratorActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = AddCollaboratorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const supabase = await createClient();

  // El cliente nunca es fuente de verdad: profile_id llega como texto de un
  // <select>, sin garantía de que sea alguien de ESTA organización — el
  // <select> del panel ya lo filtra, pero un POST directo a esta action no
  // pasa por ahí. Confirmar server-side antes de insertar.
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", parsed.data.profile_id)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  if (!targetProfile) return { error: "Esa persona no pertenece a tu organización." };

  const { error } = await supabase.from("job_collaborators").insert({
    organization_id: profile.organization_id,
    job_id: jobId,
    profile_id: parsed.data.profile_id,
    permission: parsed.data.permission,
  });
  if (error) {
    // UNIQUE(job_id, profile_id) — mensaje concreto en vez del genérico de abajo.
    return { error: error.code === "23505" ? "Esa persona ya es miembro de esta vacante." : "No se pudo agregar." };
  }

  revalidatePath(`/vacantes/${jobId}`);
  return { success: "Miembro agregado" };
}

export async function removeJobCollaborator(collaboratorId: string, jobId: string): Promise<void> {
  const profile = await requireAdminOrAbove();
  const supabase = await createClient();

  // Al reclutador asignado no se lo quita, se lo reasigna (reassignRecruiter):
  // sacarlo sin reemplazo dejaría la vacante sin nadie que pueda mover etapas
  // salvo RH. El botón de la interfaz ya ofrece "Reasignar" en su lugar, pero
  // esta action es un endpoint de red y no puede confiar en eso.
  const { data: job } = await supabase
    .from("jobs")
    .select("owner_id")
    .eq("id", jobId)
    .eq("organization_id", profile.organization_id)
    .maybeSingle();
  const { data: target } = await supabase
    .from("job_collaborators")
    .select("profile_id")
    .eq("id", collaboratorId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (!job || !target) throw new Error("No se encontró ese miembro.");
  if (job.owner_id && target.profile_id === job.owner_id) {
    throw new Error("Es el reclutador asignado: reasigna la vacante a otra persona en vez de quitarlo.");
  }

  const { error } = await supabase.from("job_collaborators").delete().eq("id", collaboratorId).eq("job_id", jobId);
  if (error) throw new Error("No se pudo eliminar al miembro.");
  revalidatePath(`/vacantes/${jobId}`);
}

/**
 * Cambia el reclutador asignado (`jobs.owner_id`) y mueve su fila de miembro
 * al reemplazo — así la lista sigue mostrando a quien de verdad lleva la
 * vacante, y el permiso de decidir (que sale de owner_id, no de esta tabla)
 * viaja con él.
 */
export async function reassignRecruiter(
  jobId: string,
  _prevState: CollaboratorActionResult | undefined,
  formData: FormData,
): Promise<CollaboratorActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = z.uuid({ error: "Elige a quién le pasa la vacante." }).safeParse(formData.get("owner_id"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Elige una persona." };

  const supabase = await createClient();

  // El reclutador asignado siempre es admin+ (mismo criterio que al aceptar
  // la solicitud) — revalidado acá, no solo filtrado en el <select>.
  const { data: target } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", parsed.data)
    .eq("organization_id", profile.organization_id)
    .eq("is_active", true)
    .in("role", ["admin", "super_admin"])
    .maybeSingle();
  if (!target) return { error: "Esa persona no puede quedar como reclutador asignado." };

  const { data: updated, error } = await supabase
    .from("jobs")
    .update({ owner_id: parsed.data })
    .eq("id", jobId)
    .eq("organization_id", profile.organization_id)
    .select("id");
  if (error || !updated || updated.length === 0) return { error: "No se pudo reasignar la vacante." };

  // Que sea miembro también, para que aparezca en la lista y en los
  // selectores de tareas y reuniones. Si ya lo era, no se toca su nivel.
  const { error: memberError } = await supabase
    .from("job_collaborators")
    .upsert(
      { organization_id: profile.organization_id, job_id: jobId, profile_id: parsed.data, permission: "lectura_escritura" },
      { onConflict: "job_id,profile_id", ignoreDuplicates: true },
    );
  if (memberError) console.error("reassignRecruiter: no se pudo sumar al nuevo reclutador como miembro", memberError);

  revalidatePath(`/vacantes/${jobId}`);
  return { success: "Reclutador reasignado" };
}
