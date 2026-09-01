import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { getApplicationDetail, getAssignableProfiles } from "@/lib/applications/get-applications";
import { CvLink } from "@/components/postulaciones/cv-link";
import { ApplicationTimeline } from "@/components/postulaciones/application-timeline";
import { NoteForm } from "@/components/postulaciones/note-form";
import { NoteList } from "@/components/postulaciones/note-list";
import { TaskForm } from "@/components/postulaciones/task-form";
import { TaskList } from "@/components/postulaciones/task-list";
import { CompetencyRow } from "@/components/postulaciones/competency-row";
import { getApplicationEvaluations } from "@/lib/competencies/get-competencies";
import { MessageForm } from "@/components/postulaciones/message-form";
import { getMessageTemplates } from "@/lib/message-templates/get-message-templates";
import { RatingStars } from "@/components/postulaciones/rating-stars";
import { RejectDialog } from "@/components/postulaciones/reject-dialog";
import { HireButton } from "@/components/postulaciones/hire-button";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  // Ninguna depende de la otra — requireProfile() solo redirige si hace
  // falta, no usa el resultado de getApplicationDetail.
  const [profile, application] = await Promise.all([requireProfile(), getApplicationDetail(applicationId)]);
  if (!application) notFound();

  const supabase = await createClient();
  // .catch() en las dos consultas nuevas a propósito: si cualquiera falla,
  // que se pierda solo esa sección (asignar tarea / evaluación), no toda
  // la página — CV, notas, calificación, etc. no dependen de esto.
  // La sección que usa `templates` (Mensaje al candidato) ya está oculta
  // para colaborador — sin este atajo, cada carga de esta página para el
  // rol más común de la plataforma dispara una consulta cuyo resultado
  // siempre se descarta.
  const [{ data: reasons }, assignable, evaluations, templates] = await Promise.all([
    supabase.from("rejection_reasons").select("id, label").eq("is_active", true),
    getAssignableProfiles(application.jobId, profile.organization_id).catch(() => []),
    getApplicationEvaluations(application.id, application.jobId, profile.id).catch(() => []),
    profile.role === "colaborador" ? Promise.resolve([]) : getMessageTemplates(profile.organization_id).catch(() => []),
  ]);

  return (
    <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[1fr_320px]">
      <div>
        <p className="text-xs text-muted-foreground">
          {application.jobTitle ?? "Vacante no disponible"} · {application.stageName ?? "Etapa no disponible"}
        </p>
        <h1 className="font-serif mt-1.5 text-[32px]">{application.candidateName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {application.candidateEmail} · {application.candidatePhone ?? "sin teléfono"}
        </p>

        <div className="mt-6">
          <CvLink cvFilePath={application.cvFilePath} />
        </div>

        {application.status !== "activa" && (
          <p className="mt-4 text-sm">
            Estado: <strong>{application.status}</strong>
            {application.rejectionReasonLabel && ` — ${application.rejectionReasonLabel}`}
          </p>
        )}

        {application.status === "activa" && profile.role !== "colaborador" && (
          <div className="mt-6 flex items-center gap-3">
            <HireButton applicationId={application.id} />
            <RejectDialog applicationId={application.id} reasons={reasons ?? []} />
          </div>
        )}

        {profile.role !== "colaborador" && (
          <section className="mt-10">
            <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Tareas</h2>
            <div className="mt-3">
              <TaskForm applicationId={application.id} assignable={assignable} />
            </div>
            <div className="mt-4">
              <TaskList tasks={application.tasks} applicationId={application.id} />
            </div>
          </section>
        )}

        {evaluations.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Evaluación</h2>
            <div className="mt-3 flex flex-col gap-3">
              {evaluations.map((e) => (
                // Prefijo con application.id: dos candidatos de la misma
                // vacante comparten competencyId (pertenece al job, no a
                // la postulación) — sin esto, navegar entre candidatos
                // puede reciclar el estado del componente (calificación
                // de un candidato "pegada" al siguiente).
                <CompetencyRow key={`${application.id}:${e.competencyId}`} applicationId={application.id} evaluation={e} />
              ))}
            </div>
          </section>
        )}

        {profile.role !== "colaborador" && (
          <section className="mt-10">
            <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Mensaje al candidato</h2>
            <div className="mt-3">
              <MessageForm applicationId={application.id} templates={templates} />
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Notas</h2>
          <div className="mt-3">
            <NoteForm applicationId={application.id} />
          </div>
          <div className="mt-5">
            <NoteList notes={application.notes} />
          </div>
        </section>
      </div>

      <div>
        <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Calificación</h2>
        <div className="mt-3">
          <RatingStars applicationId={application.id} rating={application.rating} />
        </div>

        <h2 className="mt-8 text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Actividad</h2>
        <div className="mt-3">
          <ApplicationTimeline events={application.events} />
        </div>
      </div>
    </div>
  );
}
