import { notFound } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getJobTemplateForWizard } from "@/lib/job-templates/get-job-templates";
import { getDepartmentsForOrg } from "@/lib/jobs/get-departments";
import { WizardStepsNav } from "@/components/configuracion/wizard/wizard-steps-nav";
import { WizardStep1Form } from "@/components/configuracion/wizard/wizard-step1-form";

export default async function PlantillaPaso1Page({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireAdminOrAbove();
  const { id } = await params;
  const [template, departments] = await Promise.all([
    getJobTemplateForWizard(id, profile.organization_id),
    getDepartmentsForOrg(),
  ]);

  if (!template) notFound();

  return (
    <div className="mx-auto flex max-w-4xl gap-10">
      <aside className="w-48 flex-none pt-2">
        <WizardStepsNav current={1} />
      </aside>
      <div className="flex-1">
        <h1 className="font-serif text-[32px]">Editar plantilla</h1>
        <p className="mt-1 mb-8 text-sm text-muted-foreground">
          Detalles de la vacante — la información general que trae cada vacante creada desde esta plantilla.
        </p>
        <WizardStep1Form
          departments={departments}
          templateId={template.id}
          initialValues={{
            name: template.name,
            title: template.title,
            department_id: template.department_id,
            country: template.country,
            location: template.location,
            work_mode: template.work_mode,
            employment_type: template.employment_type,
            description: template.description,
            requirements: template.requirements,
            competencies: template.competencies,
          }}
        />
      </div>
    </div>
  );
}
