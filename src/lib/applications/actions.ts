"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { NoteSchema, RejectSchema } from "./schema";

export type ApplicationActionResult = { error?: string; success?: string };

export async function moveApplicationStage(
  applicationId: string,
  fromStageId: string,
  toStageId: string,
): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  if (profile.role === "colaborador") return { error: "Tu perfil no puede mover postulaciones." };
  if (fromStageId === toStageId) return { success: "Sin cambios" };

  const supabase = await createClient();

  // Compare-and-swap: si alguien más ya la movió desde que esta pantalla
  // cargó, `fromStageId` ya no coincide con la fila real y el UPDATE no
  // afecta nada — evita que dos arrastres simultáneos se pisen en silencio
  // (mismo patrón que las transiciones de estado de vacantes en Fase 4).
  const { data, error } = await supabase
    .from("applications")
    .update({ stage_id: toStageId, stage_changed_at: new Date().toISOString(), stage_changed_by: profile.id })
    .eq("id", applicationId)
    .eq("stage_id", fromStageId)
    .select("id, organization_id")
    .single();

  if (error || !data) {
    return { error: "Alguien más ya movió esta postulación. Actualiza la página." };
  }

  await supabase.from("application_events").insert({
    organization_id: data.organization_id,
    application_id: applicationId,
    type: "etapa_cambiada",
    actor_id: profile.id,
    payload: { from: fromStageId, to: toStageId },
  });

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Etapa actualizada" };
}

export async function addNote(
  applicationId: string,
  _prevState: ApplicationActionResult | undefined,
  formData: FormData,
): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  const parsed = NoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa la nota." };

  const supabase = await createClient();
  const { data: note, error } = await supabase
    .from("notes")
    .insert({
      organization_id: profile.organization_id,
      application_id: applicationId,
      author_id: profile.id,
      body: parsed.data.body,
      is_private: parsed.data.is_private,
    })
    .select("id")
    .single();

  if (error || !note) return { error: "No se pudo guardar la nota." };

  await supabase.from("application_events").insert({
    organization_id: profile.organization_id,
    application_id: applicationId,
    type: "nota_agregada",
    actor_id: profile.id,
    payload: { is_private: parsed.data.is_private },
  });

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Nota agregada" };
}

export async function setRating(applicationId: string, rating: number): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  const parsed = z.number().int().min(0).max(5).safeParse(rating);
  if (!parsed.success) return { error: "Calificación inválida." };

  const supabase = await createClient();
  const value = parsed.data === 0 ? null : parsed.data;
  const { data, error } = await supabase
    .from("applications")
    .update({ rating: value })
    .eq("id", applicationId)
    .select("organization_id")
    .single();

  if (error || !data) return { error: "No se pudo guardar la calificación." };

  await supabase.from("application_events").insert({
    organization_id: data.organization_id,
    application_id: applicationId,
    type: "calificacion_cambiada",
    actor_id: profile.id,
    payload: { rating: value },
  });

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Calificación guardada" };
}

export async function rejectApplication(
  applicationId: string,
  _prevState: ApplicationActionResult | undefined,
  formData: FormData,
): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  if (profile.role === "colaborador") return { error: "Tu perfil no puede rechazar postulaciones." };

  const parsed = RejectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Elige un motivo." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ status: "rechazada", rejection_reason_id: parsed.data.rejection_reason_id })
    .eq("id", applicationId)
    .eq("status", "activa")
    .select("organization_id")
    .single();

  if (error || !data) return { error: "Esta postulación ya no está activa." };

  await supabase.from("application_events").insert({
    organization_id: data.organization_id,
    application_id: applicationId,
    type: "rechazada",
    actor_id: profile.id,
    payload: { rejection_reason_id: parsed.data.rejection_reason_id },
  });

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Postulación rechazada" };
}

export async function hireApplication(applicationId: string): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  if (profile.role === "colaborador") return { error: "Tu perfil no puede contratar." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ status: "contratada" })
    .eq("id", applicationId)
    .eq("status", "activa")
    .select("id")
    .single();

  if (error || !data) return { error: "Esta postulación ya no está activa." };

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Candidato contratado" };
}

export async function reopenApplication(applicationId: string): Promise<ApplicationActionResult> {
  const profile = await requireProfile();
  if (profile.role === "colaborador") return { error: "Tu perfil no puede reabrir postulaciones." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("applications")
    .update({ status: "activa", rejection_reason_id: null })
    .eq("id", applicationId)
    .eq("status", "rechazada")
    .select("id")
    .single();

  if (error || !data) return { error: "Esta postulación no está rechazada." };

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Postulación reabierta" };
}
