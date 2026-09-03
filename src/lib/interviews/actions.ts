"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send-email";
import { notifyBestEffort, getEmailContext } from "@/lib/notifications/notify";
import { EntrevistaProgramadaEmail } from "@/emails/entrevista-programada";
import { isProfileAssignable } from "@/lib/applications/get-applications";
import { canDecideApplication, canWriteApplication } from "@/lib/applications/permissions";
import { InterviewSchema, InterviewStatusSchema } from "./schema";

export type InterviewActionResult = { error?: string; success?: string };

/**
 * Corre con after() — el candidato recibe el correo con el enlace de
 * Google Calendar, pero un fallo de Resend no debe deshacer la entrevista
 * ya guardada (mismo patrón que notifyStageChange en applications/actions.ts).
 */
async function notifyCandidateOfInterview(
  candidateEmail: string,
  candidateName: string,
  jobTitle: string,
  scheduledAtIso: string,
  durationMinutes: number,
  location: string | null,
): Promise<void> {
  const { platformName } = await getEmailContext();
  await sendEmail({
    to: candidateEmail,
    subject: `Entrevista agendada — ${jobTitle}`,
    react: EntrevistaProgramadaEmail({ platformName, candidateName, jobTitle, scheduledAtIso, durationMinutes, location }),
  });
}

export async function scheduleInterview(
  applicationId: string,
  _prevState: InterviewActionResult | undefined,
  formData: FormData,
): Promise<InterviewActionResult> {
  const profile = await requireProfile();
  const parsed = InterviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };

  const supabase = await createClient();

  const { data: application } = await supabase
    .from("applications")
    .select("job_id, candidates(full_name, email), jobs(title)")
    .eq("id", applicationId)
    .single();
  if (!application) return { error: "No se encontró la postulación." };

  // Agendar manda correo al candidato a nombre de la plataforma — mismo
  // nivel de permiso que sendCandidateMessage, no el de Tareas (que no
  // tiene efecto hacia afuera).
  if (!(await canDecideApplication(profile.role, profile.id, application.job_id))) {
    return { error: "Tu perfil no puede agendar entrevistas en esta vacante." };
  }

  // El checklist del wizard ya solo ofrece gente con acceso real a la
  // vacante, pero eso es solo la UI — mismo patrón que assigned_to en
  // Tareas (Fase 10). Se revalida cada destinatario, no solo el primero.
  for (const attendeeId of parsed.data.attendee_ids) {
    if (!(await isProfileAssignable(attendeeId, application.job_id, profile.organization_id))) {
      return { error: "Uno de los destinatarios no tiene acceso a esta vacante." };
    }
  }

  const location = parsed.data.location ?? null;
  const { data: interview, error } = await supabase
    .from("interviews")
    .insert({
      organization_id: profile.organization_id,
      application_id: applicationId,
      scheduled_at: parsed.data.scheduled_at,
      duration_minutes: parsed.data.duration_minutes,
      location,
      notes: parsed.data.notes ?? null,
      created_by: profile.id,
    })
    .select("id")
    .single();
  if (error || !interview) return { error: "No se pudo agendar la entrevista." };

  // Best-effort: la entrevista en sí ya quedó registrada — si esto falla,
  // queda sin destinatarios visibles pero no rompe lo que ya se guardó.
  const { error: attendeesError } = await supabase.from("interview_attendees").insert(
    parsed.data.attendee_ids.map((profileId) => ({
      organization_id: profile.organization_id,
      interview_id: interview.id,
      profile_id: profileId,
    })),
  );
  if (attendeesError) return { error: "La entrevista se agendó pero no se pudieron guardar los destinatarios." };

  notifyBestEffort(() =>
    notifyCandidateOfInterview(
      application.candidates!.email,
      application.candidates!.full_name,
      application.jobs!.title,
      parsed.data.scheduled_at,
      parsed.data.duration_minutes,
      location,
    ),
  );

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: "Entrevista agendada" };
}

export async function updateInterviewStatus(
  interviewId: string,
  applicationId: string,
  status: "completada" | "cancelada",
): Promise<InterviewActionResult> {
  const profile = await requireProfile();
  const parsedStatus = InterviewStatusSchema.safeParse(status);
  if (!parsedStatus.success) return { error: "Estado inválido." };

  const supabase = await createClient();

  const { data: interview } = await supabase
    .from("interviews")
    .select("applications!inner(job_id), interview_attendees(profile_id)")
    .eq("id", interviewId)
    .eq("application_id", applicationId)
    .single();
  if (!interview) return { error: "No se encontró la entrevista." };

  // Quien es destinatario puede marcar su propia entrevista sin ser
  // approver/owner de la vacante (mismo auto-servicio que antes permitía
  // interviewer_id = auth.uid()); cualquier otra persona necesita el mismo
  // nivel de decisión que agendar.
  // Ser asistente no alcanza por sí solo: un miembro de SOLO LECTURA puede
  // quedar invitado y no debe poder cancelar ni completar la entrevista
  // ("no escribe nada", dice su propio nivel).
  const isAttendee =
    interview.interview_attendees.some((a) => a.profile_id === profile.id) &&
    (await canWriteApplication(profile.role, profile.id, interview.applications!.job_id));
  if (!isAttendee && !(await canDecideApplication(profile.role, profile.id, interview.applications!.job_id))) {
    return { error: "Tu perfil no puede actualizar entrevistas en esta vacante." };
  }

  // applicationId además de interviewId en el WHERE: mismo motivo que
  // toggleTask — un id desincronizado no debe revalidar la página de otra
  // postulación por error.
  // Compare-and-swap con status="programada": sin esto, dos personas con la
  // misma fila abierta podrían pisarse (una cancela, la otra marca
  // completada un instante después sin darse cuenta) — mismo patrón que
  // moveApplicationStage/rejectApplication/hireApplication.
  const { data, error } = await supabase
    .from("interviews")
    .update({ status: parsedStatus.data })
    .eq("id", interviewId)
    .eq("application_id", applicationId)
    .eq("status", "programada")
    .select("id")
    .single();
  if (error || !data) return { error: "Alguien más ya actualizó esta entrevista. Actualiza la página." };

  revalidatePath(`/postulaciones/${applicationId}`);
  return { success: status === "completada" ? "Entrevista marcada como completada" : "Entrevista cancelada" };
}

export async function deleteInterview(interviewId: string, applicationId: string): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: interview } = await supabase
    .from("interviews")
    .select("applications!inner(job_id)")
    .eq("id", interviewId)
    .eq("application_id", applicationId)
    .single();
  if (!interview) throw new Error("No se encontró la entrevista.");
  if (!(await canDecideApplication(profile.role, profile.id, interview.applications!.job_id))) {
    throw new Error("Tu perfil no puede eliminar entrevistas en esta vacante.");
  }

  const { error } = await supabase.from("interviews").delete().eq("id", interviewId).eq("application_id", applicationId);
  if (error) throw new Error("No se pudo eliminar la entrevista.");
  revalidatePath(`/postulaciones/${applicationId}`);
}
