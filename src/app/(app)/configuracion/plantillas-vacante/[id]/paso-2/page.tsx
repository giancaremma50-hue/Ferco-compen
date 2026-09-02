import { notFound } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getJobTemplateForWizard } from "@/lib/job-templates/get-job-templates";
import { WizardStepsNav } from "@/components/configuracion/wizard/wizard-steps-nav";
import { WizardStep2Form } from "@/components/configuracion/wizard/wizard-step2-form";
import { NotifyOnMount } from "@/components/ui/notify-on-mount";
import { parseCandidacyFields } from "@/lib/job-templates/candidacy-fields";
import { HelpTourButton } from "@/components/ui/help-tour-button";

const HELP_STEPS = [
  {
    selector: '[data-tour="w2-campos"]',
    title: "Los 3 estados",
    description: "Por cada campo elegís \"No aparece\" (se oculta del formulario público), \"Opcional\" (aparece pero se puede dejar en blanco) u \"Obligatorio\" (el candidato no puede postular sin llenarlo). El correo siempre es obligatorio, no se puede cambiar.",
  },
];

export default async function PlantillaPaso2Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guardado?: string }>;
}) {
  const profile = await requireAdminOrAbove();
  const { id } = await params;
  const { guardado } = await searchParams;
  const template = await getJobTemplateForWizard(id, profile.organization_id);

  if (!template) notFound();

  return (
    <div className="mx-auto flex max-w-4xl gap-10">
      {guardado && <NotifyOnMount message="Detalles guardados" />}
      <aside className="w-48 flex-none pt-2">
        <WizardStepsNav current={2} />
      </aside>
      <div className="flex-1">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[32px]">Candidatura</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Qué le pedís al candidato al postular a una vacante creada desde esta plantilla.
            </p>
          </div>
          <HelpTourButton
            intro={{ title: "El paso 2 de 6", description: "Candidatura — decidís qué campos ve el candidato en el formulario público, y si son obligatorios." }}
            steps={HELP_STEPS}
          />
        </div>
        <WizardStep2Form templateId={template.id} initialFields={parseCandidacyFields(template.candidacy_fields)} />
      </div>
    </div>
  );
}
