import { notFound } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getJobTemplateForWizard } from "@/lib/job-templates/get-job-templates";
import { getTemplateQuestions } from "@/lib/job-templates/get-template-questions";
import { WizardStepsNav } from "@/components/configuracion/wizard/wizard-steps-nav";
import { WizardStep3Form } from "@/components/configuracion/wizard/wizard-step3-form";
import { NotifyOnMount } from "@/components/ui/notify-on-mount";
import { HelpTourButton } from "@/components/ui/help-tour-button";

const HELP_STEPS = [
  { selector: '[data-tour="w3-tipo"]', title: "Abierta vs. opción múltiple", description: "Abierta: el candidato escribe libre, nadie la califica en automático. Opción múltiple: elige una entre las que definas — y esas sí pueden precalificar." },
  { selector: '[data-tour="w3-esperada"]', title: "Marcar \"Esperada\"", description: "En una pregunta de opción múltiple, marcá la opción correcta. Si TODAS las respuestas de opción múltiple del candidato coinciden con lo marcado, su postulación queda registrada como precalificada — es un dato guardado, no descarta a nadie ni mueve nada solo." },
];

export default async function PlantillaPaso3Page({
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

  const questions = await getTemplateQuestions(id);

  return (
    <div className="mx-auto flex max-w-4xl gap-10">
      {guardado && <NotifyOnMount message="Candidatura guardada" />}
      <aside className="w-48 flex-none pt-2">
        <WizardStepsNav current={3} />
      </aside>
      <div className="flex-1">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[32px]">Preguntas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Preguntas de precalificación para quien postule a una vacante creada desde esta plantilla — las de opción
              múltiple pueden marcar una respuesta esperada.
            </p>
          </div>
          <HelpTourButton
            intro={{ title: "El paso 3 de 6", description: "Preguntas — opcional. Un banco de preguntas por vacante, con precalificación automática y determinística (sin IA) para las de opción múltiple." }}
            steps={HELP_STEPS}
          />
        </div>
        <WizardStep3Form templateId={template.id} initialQuestions={questions} />
      </div>
    </div>
  );
}
