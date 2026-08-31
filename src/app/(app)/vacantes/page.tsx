import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { getJobsForViewer } from "@/lib/jobs/get-jobs";
import { JobCard } from "@/components/vacantes/job-card";

export default async function VacantesPage() {
  const profile = await requireProfile();
  const jobs = await getJobsForViewer();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[32px]">Vacantes</h1>
        {profile.role !== "colaborador" && (
          <Link
            href="/vacantes/nueva"
            className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white"
          >
            Solicitar vacante
          </Link>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">
            Todavía no hay vacantes {profile.role === "colaborador" ? "publicadas" : "para mostrar"}.
          </p>
          {profile.role === "colaborador" ? (
            <Link href="/empleos" className="text-sm font-medium text-accent underline" target="_blank">
              Ver el portal de empleos
            </Link>
          ) : (
            <Link href="/vacantes/nueva" className="text-sm font-medium text-accent underline">
              Solicitar la primera vacante
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-8 grid gap-3">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
