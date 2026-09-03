import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApplicationForm } from "@/components/empleos/application-form";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/lib/jobs/schema";
import type { WorkMode, EmploymentType } from "@/lib/jobs/schema";
import { parseCandidacyFields } from "@/lib/job-templates/candidacy-fields";

export default async function EmpleoDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("jobs")
    .select("id, title, country, location, work_mode, employment_type, description, requirements, candidacy_fields")
    .eq("slug", slug)
    .eq("status", "abierta")
    .eq("visibility", "publica")
    .maybeSingle();

  if (!job) notFound();

  const { data: questions } = await supabase
    .from("job_questions")
    .select("id, prompt, type, job_question_options(id, label, position)")
    .eq("job_id", job.id)
    .order("position")
    .order("position", { referencedTable: "job_question_options" });

  return (
    <div className="mx-auto grid max-w-4xl gap-12 px-6 py-16 lg:grid-cols-[1fr_360px]">
      <div>
        <h1 className="font-serif text-[38px] leading-tight">{job.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {[job.location, job.country].filter(Boolean).join(", ")}
          {job.work_mode && ` · ${WORK_MODE_LABEL[job.work_mode as WorkMode] ?? job.work_mode}`}
          {job.employment_type &&
            ` · ${EMPLOYMENT_TYPE_LABEL[job.employment_type as EmploymentType] ?? job.employment_type}`}
        </p>

        <section className="mt-8">
          <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Descripción</h2>
          <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed">{job.description}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Requisitos</h2>
          <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed">{job.requirements}</p>
        </section>
      </div>

      <div className="h-fit border border-border bg-card p-6">
        <h2 className="font-serif text-xl">Postula a esta vacante</h2>
        <div className="mt-5">
          <ApplicationForm
            jobId={job.id}
            candidacyFields={parseCandidacyFields(job.candidacy_fields)}
            questions={questions ?? []}
          />
        </div>
      </div>
    </div>
  );
}
