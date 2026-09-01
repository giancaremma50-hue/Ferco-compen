import { requireAdminOrAbove } from "@/lib/auth/dal";
import { PipelineTemplateForm } from "@/components/configuracion/pipeline-template-form";

export default async function NuevaPipelinePage() {
  await requireAdminOrAbove();

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="font-serif text-2xl">Nueva plantilla de pipeline</h2>
      <div className="mt-5">
        <PipelineTemplateForm />
      </div>
    </div>
  );
}
