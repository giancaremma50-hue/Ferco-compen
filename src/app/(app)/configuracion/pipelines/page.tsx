import Link from "next/link";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getPipelineTemplates } from "@/lib/pipeline-templates/get-pipeline-templates";
import { PipelineTemplateRow } from "@/components/configuracion/pipeline-template-row";
import { ActionButton } from "@/components/ui/action-button";

export default async function PipelinesPage() {
  const profile = await requireAdminOrAbove();
  const templates = await getPipelineTemplates(profile.organization_id);

  return (
    <section className="border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <h2 className="font-serif text-2xl">Pipelines</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {templates.length} plantillas. Se copia a cada vacante nueva; editarla no afecta procesos en curso.
          </p>
        </div>
        <Link href="/configuracion/pipelines/nueva">
          <ActionButton type="button">Nueva plantilla</ActionButton>
        </Link>
      </div>

      <div className="px-5 pb-5">
        {templates.length === 0 ? (
          <p className="p-8 text-sm text-muted-foreground">Todavía no hay plantillas de pipeline.</p>
        ) : (
          templates.map((t) => <PipelineTemplateRow key={t.id} template={t} />)
        )}
      </div>
    </section>
  );
}
