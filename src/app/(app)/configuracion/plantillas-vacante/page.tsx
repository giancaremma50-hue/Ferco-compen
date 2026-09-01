import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getJobTemplates } from "@/lib/job-templates/get-job-templates";
import { getPipelineTemplateOptions } from "@/lib/pipeline-templates/get-pipeline-templates";
import { JobTemplateRow } from "@/components/configuracion/job-template-row";
import { JobTemplateDialog } from "@/components/configuracion/job-template-dialog";
import { ActionButton } from "@/components/ui/action-button";

export default async function PlantillasVacantePage() {
  const profile = await requireAdminOrAbove();
  const [templates, pipelineOptions] = await Promise.all([
    getJobTemplates(profile.organization_id),
    getPipelineTemplateOptions(profile.organization_id),
  ]);

  return (
    <section className="border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl">Plantillas de vacante</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Puestos recurrentes listos para prellenar al solicitar una vacante nueva.
          </p>
        </div>
        <JobTemplateDialog pipelineTemplates={pipelineOptions} trigger={<ActionButton type="button">Nueva plantilla</ActionButton>} />
      </div>

      <div className="mt-6">
        {templates.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">Todavía no hay plantillas configuradas.</p>
        ) : (
          templates.map((t) => <JobTemplateRow key={t.id} template={t} pipelineTemplates={pipelineOptions} />)
        )}
      </div>
    </section>
  );
}
