import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getJobById } from "@/lib/jobs/get-jobs";
import { getJobCollaborators } from "@/lib/jobs/get-collaborators";
import { getKanbanData } from "@/lib/applications/get-applications";
import { KanbanBoard } from "@/components/pipeline/kanban-board";
import { JobInfoModal } from "@/components/vacantes/job-info-modal";

export default async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();
  const job = await getJobById(id);
  if (!job) notFound();

  const [data, collaborators] = await Promise.all([getKanbanData(id), getJobCollaborators(id)]);

  return (
    // Se sale del ancho centrado de <main> (max-w-6xl) a propósito — el
    // pipeline necesita todo el ancho de la ventana, no el de lectura de
    // una página de texto. calc(100vh - 13.5rem) replica exactamente el
    // encabezado (h-16) + el padding vertical de <main> (pt-10 + pb-28) del
    // layout compartido, para que el tablero llene el alto real disponible
    // sin generar scroll de página (cada columna scrollea la suya).
    <div className="mx-[calc(50%-50vw)] flex h-[calc(100vh-13.5rem)] flex-col px-6 lg:px-10">
      <div className="flex flex-none items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[28px]">{job.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pipeline · {data.cards.length} postulaciones activas</p>
        </div>
        <JobInfoModal job={job} collaborators={collaborators} />
      </div>
      <div className="mt-6 min-h-0 flex-1">
        <KanbanBoard initialData={data} jobTitle={job.title} />
      </div>
    </div>
  );
}
