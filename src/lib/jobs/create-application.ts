import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type CandidateInsert = Database["public"]["Tables"]["candidates"]["Insert"];
type CandidateInput = Omit<CandidateInsert, "organization_id" | "email"> & { email: string };

export type FindCandidateResult = { error: string } | { candidateId: string; isNewCandidate: boolean };

/**
 * Busca al candidato por email dentro de la organización y lo crea si no
 * existe. SIEMPRE usa el cliente admin, nunca uno de sesión: la
 * deduplicación por email debe ser una verdad de toda la organización, no
 * lo que candidates_select deja ver al actor de turno — con el cliente de
 * sesión, un colaborador sin acceso al candidato que otro ya refirió no lo
 * encontraría y crearía una fila duplicada para el mismo correo.
 */
export async function findOrCreateCandidate(
  organizationId: string,
  candidateInput: CandidateInput,
  knownCandidateId?: string,
): Promise<FindCandidateResult> {
  const admin = createAdminClient();
  const email = candidateInput.email.toLowerCase();

  if (knownCandidateId) return { candidateId: knownCandidateId, isNewCandidate: false };

  const { data: existing } = await admin
    .from("candidates")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("email", email)
    .maybeSingle();

  if (existing) return { candidateId: existing.id, isNewCandidate: false };

  const { data: created, error: createError } = await admin
    .from("candidates")
    .insert({ ...candidateInput, organization_id: organizationId, email })
    .select("id")
    .single();

  if (createError?.code === "23505") {
    // Carrera: otra solicitud casi simultánea (doble clic, dos
    // postulaciones a vacantes distintas) ya insertó este correo entre el
    // select de arriba y este insert.
    const { data: raceWinner } = await admin
      .from("candidates")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .maybeSingle();
    if (!raceWinner) return { error: "No se pudo registrar al candidato." };
    return { candidateId: raceWinner.id, isNewCandidate: false };
  }
  if (createError || !created) return { error: "No se pudo registrar al candidato." };

  return { candidateId: created.id, isNewCandidate: true };
}

export type CreateApplicationResult =
  | { error: string; duplicate?: boolean }
  | { applicationId: string };

/** Revierte el candidato SOLO si se acababa de crear en esta misma operación — nunca uno preexistente. */
export async function rollbackIfNewCandidate(candidateId: string, isNewCandidate: boolean): Promise<void> {
  if (!isNewCandidate) return;
  await createAdminClient().from("candidates").delete().eq("id", candidateId);
}

/**
 * Registra la postulación en la primera etapa del pipeline de la vacante.
 * `supabase` sí importa aquí (a diferencia de findOrCreateCandidate): el
 * permiso real por vacante lo decide applications_insert vía RLS, así que
 * este insert usa el cliente del actor (de sesión) o el admin (portal
 * público), según quién esté llamando. Si falla, revierte el candidato con
 * `rollbackIfNewCandidate` — el llamador debe usar la misma función si
 * necesita revertir en un paso previo (ej. la subida del CV en el portal).
 *
 * `extra` es exclusivo del portal público (carta de motivación,
 * precalificación) — `referCandidate` (referido interno, Fase 4/6) no lo
 * manda, esos dos campos se quedan `null` en ese camino.
 */
export async function createApplicationForCandidate(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  jobId: string,
  candidateId: string,
  isNewCandidate: boolean,
  extra?: { cover_letter?: string | null; prequalified?: boolean | null },
): Promise<CreateApplicationResult> {
  const { data: firstStage } = await supabase
    .from("job_stages")
    .select("id")
    .eq("job_id", jobId)
    .order("position")
    .limit(1)
    .single();

  if (!firstStage) {
    await rollbackIfNewCandidate(candidateId, isNewCandidate);
    return { error: "Esta vacante no tiene un proceso configurado todavía." };
  }

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .insert({
      job_id: jobId,
      candidate_id: candidateId,
      organization_id: organizationId,
      stage_id: firstStage.id,
      cover_letter: extra?.cover_letter ?? null,
      prequalified: extra?.prequalified ?? null,
    })
    .select("id")
    .single();

  if (applicationError || !application) {
    await rollbackIfNewCandidate(candidateId, isNewCandidate);

    // 23505 = violación de UNIQUE(job_id, candidate_id): ya había postulado.
    // Cualquier otro código (ej. RLS negó el insert porque este actor no
    // tiene acceso a la vacante, o la etapa cambió a mitad de la solicitud)
    // es un error distinto y no debe reportarse como duplicado.
    if (applicationError?.code === "23505") {
      return { error: "Ya existe una postulación registrada para esta vacante.", duplicate: true };
    }
    return { error: "No se pudo registrar la postulación. Inténtalo de nuevo." };
  }

  return { applicationId: application.id };
}
