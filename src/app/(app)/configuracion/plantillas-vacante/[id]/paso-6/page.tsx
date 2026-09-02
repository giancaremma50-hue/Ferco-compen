import { notFound } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getJobTemplateForWizard } from "@/lib/job-templates/get-job-templates";
import { WizardStepsNav } from "@/components/configuracion/wizard/wizard-steps-nav";
import { WizardStep6Form } from "@/components/configuracion/wizard/wizard-step6-form";
import { NotifyOnMount } from "@/components/ui/notify-on-mount";
import { HelpTourButton } from "@/components/ui/help-tour-button";

const HELP_STEPS = [
  { selector: '[data-tour="w6-publicar"]', title: "Crear plantilla", description: "La publica de una — recién ahí aparece en el selector de \"Nueva vacante\". Necesita haber guardado el paso 4 (Etapas) al menos una vez; si nunca llegaste a ese paso, publicar se rechaza." },
  { selector: '[data-tour="w6-borrador"]', title: "Crear borrador", description: "La guarda tal cual está, sin publicarla. Aparece en el listado con la etiqueta \"Borrador\" y podés retomarla después con \"Continuar\" — nadie más puede usarla para crear una vacante todavía." },
];

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
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[32px]">Cierre</h1>
            <p className="mt-1 text-sm text-muted-foreground">Último paso — publicá la plantilla o dejala como borrador.</p>
          </div>
          <HelpTourButton
            intro={{ title: "El paso 6 de 6", description: "Cierre — la última decisión: ¿ya está lista para usarse, o la dejás guardada para retocarla después?" }}
            steps={HELP_STEPS}
          />
        </div>
        <WizardStep6Form templateId={template.id} templateName={template.name} />
      </div>
    </div>
  );
}
