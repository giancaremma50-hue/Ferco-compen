import { notFound } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getJobTemplateForWizard } from "@/lib/job-templates/get-job-templates";
import { WizardStepsNav } from "@/components/configuracion/wizard/wizard-steps-nav";
import { WizardStep6Form } from "@/components/configuracion/wizard/wizard-step6-form";
import { NotifyOnMount } from "@/components/ui/notify-on-mount";

export default async function PlantillaPaso6Page({
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
      {guardado && <NotifyOnMount message="Permisos guardados" />}
      <aside className="w-48 flex-none pt-2">
        <WizardStepsNav current={6} />
      </aside>
      <div className="flex-1">
        <h1 className="font-serif text-[32px]">Cierre</h1>
        <p className="mt-1 mb-8 text-sm text-muted-foreground">Último paso — publicá la plantilla o dejala como borrador.</p>
        <WizardStep6Form templateId={template.id} templateName={template.name} />
      </div>
    </div>
  );
}
