import { notFound } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getJobTemplateForWizard } from "@/lib/job-templates/get-job-templates";
import { WizardStepsNav } from "@/components/configuracion/wizard/wizard-steps-nav";
import { WizardStep5Form } from "@/components/configuracion/wizard/wizard-step5-form";
import { NotifyOnMount } from "@/components/ui/notify-on-mount";

export default async function PlantillaPaso5Page({
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
      {guardado && <NotifyOnMount message="Etapas guardadas" />}
      <aside className="w-48 flex-none pt-2">
        <WizardStepsNav current={5} />
      </aside>
      <div className="flex-1">
        <h1 className="font-serif text-[32px]">Permisos y usos</h1>
        <p className="mt-1 mb-8 text-sm text-muted-foreground">Quién puede ver esta plantilla en el bolsón.</p>
        <WizardStep5Form templateId={template.id} isConfidential={template.is_confidential} />
      </div>
    </div>
  );
}
