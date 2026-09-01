import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getDepartmentsForOrg } from "@/lib/jobs/get-departments";
import { getJobTemplates } from "@/lib/job-templates/get-job-templates";
import { NuevaVacanteForm } from "@/components/vacantes/nueva-vacante-form";

export default async function NuevaVacantePage() {
  const profile = await requireProfile();
  if (profile.role === "colaborador") redirect("/vacantes");

  const [departments, jobTemplates] = await Promise.all([
    getDepartmentsForOrg(),
    getJobTemplates(profile.organization_id).catch(() => []),
  ]);

  // Solo los campos que la fusión en el cliente necesita — pipeline_template_id
  // y competencies no viajan al navegador, createJob los vuelve a consultar
  // server-side a partir del id elegido (ver comentario en jobs/actions.ts).
  const templates = jobTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    title: t.title,
    country: t.country,
    location: t.location,
    work_mode: t.work_mode,
    employment_type: t.employment_type,
    description: t.description,
    requirements: t.requirements,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-[32px]">Solicitar vacante</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Se crea en borrador — puedes ajustarla antes de enviarla a aprobación.
      </p>
      <NuevaVacanteForm departments={departments} templates={templates} />
    </div>
  );
}
