import { notFound } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getJobTemplateForWizard } from "@/lib/job-templates/get-job-templates";
import { WizardStepsNav } from "@/components/configuracion/wizard/wizard-steps-nav";
import { WizardStep5Form } from "@/components/configuracion/wizard/wizard-step5-form";
import { NotifyOnMount } from "@/components/ui/notify-on-mount";
import { HelpTourButton } from "@/components/ui/help-tour-button";

const HELP_STEPS = [
  { selector: '[data-tour="w5-confidencial"]', title: "Confidencial", description: "Marcada, solo quien la creó (y super_admin, que ve todo) puede verla o elegirla — ni siquiera otro admin. Útil para un puesto sensible (ej. un reemplazo que todavía no se anuncia)." },
];

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
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[32px]">Permisos y usos</h1>
            <p className="mt-1 text-sm text-muted-foreground">Quién puede ver esta plantilla en el bolsón.</p>
          </div>
          <HelpTourButton
            intro={{ title: "El paso 5 de 6", description: "Permisos — un solo interruptor, pero cambia quién puede elegir esta plantilla al crear una vacante." }}
            steps={HELP_STEPS}
          />
        </div>
        <WizardStep5Form templateId={template.id} isConfidential={template.is_confidential} />
      </div>
    </div>
  );
}
