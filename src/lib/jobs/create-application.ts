import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type CandidateInsert = Database["public"]["Tables"]["candidates"]["Insert"];
type CandidateInput = Omit<CandidateInsert, "organization_id" | "email"> & { email: string };

export type CreateApplicationResult =
  | { error: string; duplicate?: boolean }
  | { candidateId: string; applicationId: string; isNewCandidate: boolean };

/**
 * Compartido entre el portal público (/api/postular, cliente admin) y los
 * referidos internos (referCandidate, cliente de sesión).
 *
 * La búsqueda/creación/reversión del candidato usa SIEMPRE el cliente admin,
 * nunca el `supabase` recibido: la deduplicación por email debe ser una
 * verdad de toda la organización, no lo que candidates_select deja ver al
 * actor de turno. Con el cliente de sesión, un colaborador sin acceso al
 * candidato que otro ya refirió no lo encontraría (`existing` = null) y
 * crearía una fila duplicada para el mismo correo — exactamente lo que este
 * dedup existe para evitar. Por la misma razón, revertir un candidato recién
 * creado también necesita el cliente admin: candidates_delete_admin exige
 * ser admin+, así que un colaborador nunca podría borrar ni el candidato que
 * él mismo acaba de crear.
 *
 * El insert de `applications`, en cambio, sí usa el `supabase` recibido: ahí
 * es donde debe aplicar el permiso real por vacante (RLS de applications_insert).
 */
export async function findOrCreateApplication(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  jobId: string,
  candidateInput: CandidateInput,
  // El llamador puede pasar un id ya resuelto (ver postular/route.ts, que
  // hace este mismo lookup antes para decidir si vale la pena subir el CV)
  // y así evitar repetir la misma consulta dos veces en la misma request.
  knownCandidateId?: string,
): Promise<CreateApplicationResult> {
  const admin = createAdminClient();
  const email = candidateInput.email.toLowerCase();

  let candidateId = knownCandidateId;
  if (!candidateId) {
    const { data: existing } = await admin
      .from("candidates")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .maybeSingle();
    candidateId = existing?.id;
  }
  let isNewCandidate = !candidateId;

  if (!candidateId) {
    const { data: created, error: createError } = await admin
      .from("candidates")
      .insert({ ...candidateInput, organization_id: organizationId, email })
      .select("id")
      .single();

    if (createError?.code === "23505") {
      // Carrera: otra solicitud casi simultánea (doble clic, dos
      // postulaciones a vacantes distintas) ya insertó este correo entre el
      // select de arriba y este insert. No es un candidato nuevo de esta
      // llamada — no hay que revertirlo si algo falla más adelante.
      const { data: raceWinner } = await admin
        .from("candidates")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("email", email)
        .maybeSingle();
      if (!raceWinner) return { error: "No se pudo registrar al candidato." };
      candidateId = raceWinner.id;
      isNewCandidate = false;
    } else if (createError || !created) {
      return { error: "No se pudo registrar al candidato." };
    } else {
      candidateId = created.id;
    }
  }

  const { data: firstStage } = await supabase
    .from("job_stages")
    .select("id")
    .eq("job_id", jobId)
    .order("position")
    .limit(1)
    .single();

  if (!firstStage) {
    if (isNewCandidate) await admin.from("candidates").delete().eq("id", candidateId);
    return { error: "Esta vacante no tiene un proceso configurado todavía." };
  }

  const { data: application, error: applicationError } = await supabase
    .from("applications")
    .insert({
      job_id: jobId,
      candidate_id: candidateId,
      organization_id: organizationId,
      stage_id: firstStage.id,
    })
    .select("id")
    .single();

  if (applicationError || !application) {
    if (isNewCandidate) await admin.from("candidates").delete().eq("id", candidateId);

    // 23505 = violación de UNIQUE(job_id, candidate_id): ya había postulado.
    // Cualquier otro código (ej. RLS negó el insert porque este actor no
    // tiene acceso a la vacante, o la etapa cambió a mitad de la solicitud)
    // es un error distinto y no debe reportarse como duplicado.
    if (applicationError?.code === "23505") {
      return { error: "Ya existe una postulación registrada para esta vacante.", duplicate: true };
    }
    return { error: "No se pudo registrar la postulación. Inténtalo de nuevo." };
  }

  return { candidateId, applicationId: application.id, isNewCandidate };
}
