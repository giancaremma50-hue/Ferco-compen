import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getDepartmentsForOrg } from "@/lib/jobs/get-departments";
import { WizardStepsNav } from "@/components/configuracion/wizard/wizard-steps-nav";
import { WizardStep1Form } from "@/components/configuracion/wizard/wizard-step1-form";

export default async function NuevaPlantillaWizardPage() {
  await requireAdminOrAbove();
  const departments = await getDepartmentsForOrg();

  return (
    <div className="mx-auto flex max-w-4xl gap-10">
      <aside className="w-48 flex-none pt-2">
        <WizardStepsNav current={1} />
      </aside>
      <div className="flex-1">
        <h1 className="font-serif text-[32px]">Nueva plantilla de puesto</h1>
        <p className="mt-1 mb-8 text-sm text-muted-foreground">
          Detalles de la vacante — la información general que trae cada vacante creada desde esta plantilla.
        </p>
        <WizardStep1Form departments={departments} />
      </div>
    </div>
  );
}
