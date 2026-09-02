import { notFound } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getJobTemplateForWizard } from "@/lib/job-templates/get-job-templates";
import { getTemplateStages } from "@/lib/job-templates/get-template-stages";
import { getPipelineTemplatesWithStages } from "@/lib/pipeline-templates/get-pipeline-templates";
import { WizardStepsNav } from "@/components/configuracion/wizard/wizard-steps-nav";
import { WizardStep4Form } from "@/components/configuracion/wizard/wizard-step4-form";
import { NotifyOnMount } from "@/components/ui/notify-on-mount";
import { HelpTourButton } from "@/components/ui/help-tour-button";

const HELP_STEPS = [
  { selector: '[data-tour="w4-kanban"]', title: "3 etapas fijas, el resto tuyo", description: "Bandeja de entrada (donde cae toda postulación nueva), Contratado y Descartado siempre están y siempre van primero/último. Las de en medio (preselección, entrevista, oferta) las armás vos, en el orden que quieras." },
  { selector: '[data-tour="w4-set-guardado"]', title: "Empezar desde un set guardado", description: "Copia las etapas intermedias de otra plantilla como punto de partida — no las vincula, es una copia que podés seguir editando sin tocar el set original." },
  { selector: '[data-tour="w4-reutilizable"]', title: "Guardar como set reutilizable", description: "Al revés del punto anterior: guarda ESTAS etapas con un nombre, para poder arrancar otra plantilla futura desde acá." },
];

export default async function PlantillaPaso4Page({
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

  const [stages, savedSets] = await Promise.all([
    getTemplateStages(id),
    getPipelineTemplatesWithStages(profile.organization_id),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl gap-10">
      {guardado && <NotifyOnMount message="Preguntas guardadas" />}
      <aside className="w-48 flex-none pt-2">
        <WizardStepsNav current={4} />
      </aside>
      <div className="flex-1">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[32px]">Etapas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              El kanban de esta plantilla. Bandeja de entrada, Contratado y Descartado son fijas — agregá lo que va en
              medio.
            </p>
          </div>
          <HelpTourButton
            intro={{ title: "El paso 4 de 6", description: "Etapas — el kanban por el que va a pasar cada candidato de una vacante creada desde esta plantilla." }}
            steps={HELP_STEPS}
          />
        </div>
        <WizardStep4Form templateId={template.id} initialStages={stages} savedSets={savedSets} />
      </div>
    </div>
  );
}
