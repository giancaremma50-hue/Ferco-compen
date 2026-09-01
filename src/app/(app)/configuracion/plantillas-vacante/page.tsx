import { requireAdminOrAbove } from "@/lib/auth/dal";
import { getJobTemplates } from "@/lib/job-templates/get-job-templates";
import { getPipelineTemplateOptions } from "@/lib/pipeline-templates/get-pipeline-templates";
import { JobTemplateRow } from "@/components/configuracion/job-template-row";
import { JobTemplateDialog } from "@/components/configuracion/job-template-dialog";
import { ActionButton } from "@/components/ui/action-button";
import { NotifyOnMount } from "@/components/ui/notify-on-mount";

export default async function PlantillasVacantePage({
  searchParams,
}: {
  // El wizard redirige acá recién en el cierre (paso 6) — cada paso
  // intermedio confirma en su propia página (ver paso-2 a paso-6), este
  // listado solo confirma el resultado final. "confidencial" llega desde el
  // paso 5 cuando quien la marcó confidencial no es su creador — a partir de
  // ahí ya no la ve ni en este mismo listado, así que no tiene sentido
  // mandarlo al paso 6 (le daría 404).
  searchParams: Promise<{ borrador?: string; publicada?: string; confidencial?: string }>;
}) {
  const profile = await requireAdminOrAbove();
  const { borrador, publicada, confidencial } = await searchParams;
  const [templates, pipelineOptions] = await Promise.all([
    getJobTemplates(profile.organization_id),
    getPipelineTemplateOptions(profile.organization_id),
  ]);

  return (
    <section className="border border-border bg-card p-5">
      {borrador && <NotifyOnMount message="Guardada como borrador" />}
      {publicada && <NotifyOnMount message="Plantilla publicada" />}
      {confidencial && <NotifyOnMount message="Guardado — como no la creaste vos, ya no te aparece" />}
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
