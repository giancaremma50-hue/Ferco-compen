import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getDepartmentsForOrg } from "@/lib/jobs/get-departments";
import { createJob } from "@/lib/jobs/actions";
import { JobForm } from "@/components/vacantes/job-form";

export default async function NuevaVacantePage() {
  const profile = await requireProfile();
  if (profile.role === "colaborador") redirect("/vacantes");

  const departments = await getDepartmentsForOrg();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-[32px]">Solicitar vacante</h1>
      <p className="mt-1 mb-8 text-sm text-muted-foreground">
        Se crea en borrador — puedes ajustarla antes de enviarla a aprobación.
      </p>
      <JobForm action={createJob} departments={departments} submitLabel="Crear vacante" />
    </div>
  );
}
