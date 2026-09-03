import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { getJobsForViewer } from "@/lib/jobs/get-jobs";
import { JobCard } from "@/components/vacantes/job-card";

export default async function VacantesPage() {
  // Sin asignar: acá `requireProfile()` es solo la puerta (redirige si no hay
  // perfil o está inactivo). Ya no hace falta el rol para decidir qué mostrar
  // — los 3 roles que existen pueden solicitar una vacante: el gestor la pide,
  // admin y super admin la crean ya aceptada (ver createJob).
  await requireProfile();
  const jobs = await getJobsForViewer();

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-[32px]">Vacantes</h1>
        <Link
          href="/vacantes/nueva"
          className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-white"
        >
          Solicitar vacante
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="mt-10 flex flex-col items-start gap-3">
          <p className="text-sm text-muted-foreground">Todavía no hay vacantes para mostrar.</p>
          <Link href="/vacantes/nueva" className="text-sm font-medium text-accent underline">
            Solicitar la primera vacante
          </Link>
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
