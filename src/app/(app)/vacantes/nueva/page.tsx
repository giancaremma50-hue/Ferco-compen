import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getDepartmentsForOrg } from "@/lib/jobs/get-departments";
import { createJob } from "@/lib/jobs/actions";
import { JobForm } from "@/components/vacantes/job-form";
import { TemplatePicker } from "@/components/vacantes/template-picker";
import { getJobTemplates } from "@/lib/job-templates/get-job-templates";

export default async function NuevaVacantePage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role === "colaborador") redirect("/vacantes");
  const { template: templateId } = await searchParams;

  const [departments, templates] = await Promise.all([
    getDepartmentsForOrg(),
    getJobTemplates(profile.organization_id).catch(() => []),
  ]);
  const selectedTemplate = templateId ? (templates.find((t) => t.id === templateId) ?? null) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-[32px]">Solicitar vacante</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Se crea en borrador — puedes ajustarla antes de enviarla a aprobación.
      </p>
      <div className="mb-8">
        {/* Solo id+name viajan al cliente — el resto de cada plantilla
            (descripción, requisitos...) no le hace falta al <select>. */}
        <TemplatePicker templates={templates.map((t) => ({ id: t.id, name: t.name }))} selectedId={selectedTemplate?.id} />
      </div>
      {/* key fuerza a remontar el formulario (no controlado) cuando cambia
          la plantilla — defaultValue solo aplica al montar, no se
          actualiza solo si el componente sigue siendo la misma instancia. */}
      <JobForm key={selectedTemplate?.id ?? "blank"} action={createJob} departments={departments} defaultValues={selectedTemplate ?? undefined} submitLabel="Crear vacante" />
    </div>
  );
}
