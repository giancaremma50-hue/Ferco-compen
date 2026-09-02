import { notFound } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getJobTemplateForWizard } from "@/lib/job-templates/get-job-templates";
import { getDepartmentsForOrg } from "@/lib/jobs/get-departments";
import { WizardStepsNav } from "@/components/configuracion/wizard/wizard-steps-nav";
import { WizardStep1Form } from "@/components/configuracion/wizard/wizard-step1-form";
import { HelpTourButton } from "@/components/ui/help-tour-button";

const HELP_STEPS = [
  { selector: '[data-tour="w1-puesto"]', title: "Puesto", description: "El nombre interno de la plantilla — lo ve tu equipo al elegirla para crear una vacante, nunca el candidato." },
  { selector: '[data-tour="w1-titulo"]', title: "Título del anuncio", description: "Este sí lo ve el candidato: es el título que aparece en la bolsa de empleo pública." },
  { selector: '[data-tour="w1-descripcion"]', title: "Descripción del puesto", description: "También pública — se copia tal cual a cada vacante creada desde esta plantilla." },
  { selector: '[data-tour="w1-rubrica"]', title: "Rúbrica de evaluación", description: "Opcional. Competencias con un peso cada una (0-100) para calificar candidatos de forma consistente en el pipeline — no la ve el candidato." },
];

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
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[32px]">Editar plantilla de puesto</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Detalles de la vacante — la información general que trae cada vacante creada desde esta plantilla.
            </p>
          </div>
          <HelpTourButton
            intro={{
              title: "El paso 1 de 6",
              description: "Detalles — lo que cada vacante creada desde esta plantilla va a traer prellenado. Algunos campos los ve el candidato, otros son solo internos.",
            }}
            steps={HELP_STEPS}
          />
        </div>
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
