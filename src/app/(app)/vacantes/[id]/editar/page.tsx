import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getJobById } from "@/lib/jobs/get-jobs";
import { getDepartmentsForOrg } from "@/lib/jobs/get-departments";
import { updateJob } from "@/lib/jobs/actions";
import { canEditJob } from "@/lib/jobs/permissions";
import { JobForm } from "@/components/vacantes/job-form";

export default async function EditarVacantePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const job = await getJobById(id);

  if (!job) notFound();

  if (!canEditJob(profile.role, profile.id, job)) redirect(`/vacantes/${id}`);

  const departments = await getDepartmentsForOrg();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-[32px]">Editar vacante</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">{job.code}</p>
      <JobForm
        action={updateJob.bind(null, job.id)}
        departments={departments}
        defaultValues={job}
        submitLabel="Guardar cambios"
      />
    </div>
  );
}
