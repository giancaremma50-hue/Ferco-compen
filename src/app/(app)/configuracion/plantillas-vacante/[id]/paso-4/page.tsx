import { notFound } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getJobTemplateForWizard } from "@/lib/job-templates/get-job-templates";
import { getTemplateStages } from "@/lib/job-templates/get-template-stages";
import { getPipelineTemplatesWithStages } from "@/lib/pipeline-templates/get-pipeline-templates";
import { WizardStepsNav } from "@/components/configuracion/wizard/wizard-steps-nav";
import { WizardStep4Form } from "@/components/configuracion/wizard/wizard-step4-form";
import { NotifyOnMount } from "@/components/ui/notify-on-mount";

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
        <h1 className="font-serif text-[32px]">Etapas</h1>
        <p className="mt-1 mb-8 text-sm text-muted-foreground">
          El kanban de esta plantilla. Bandeja de entrada, Contratado y Descartado son fijas — agregá lo que va en
          medio.
        </p>
        <WizardStep4Form templateId={template.id} initialStages={stages} savedSets={savedSets} />
      </div>
    </div>
  );
}
