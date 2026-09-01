import { notFound } from "next/navigation";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getPipelineTemplate } from "@/lib/pipeline-templates/get-pipeline-templates";
import { PipelineTemplateForm } from "@/components/configuracion/pipeline-template-form";

export default async function EditarPipelinePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminOrAbove();
  const { id } = await params;
  const data = await getPipelineTemplate(id);
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <h2 className="font-serif text-2xl">Editar plantilla</h2>
      <div className="mt-5">
        <PipelineTemplateForm
          template={{
            id: data.template.id,
            name: data.template.name,
            stages: data.stages.map((s) => ({ name: s.name, type: s.type })),
          }}
        />
      </div>
    </div>
  );
}
