import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getJobById } from "@/lib/jobs/get-jobs";
import { getKanbanData } from "@/lib/applications/get-applications";
import { KanbanBoard } from "@/components/pipeline/kanban-board";

export default async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireProfile();
  const job = await getJobById(id);
  if (!job) notFound();

  const data = await getKanbanData(id);

  return (
    <div>
      <h1 className="font-serif text-[32px]">{job.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Pipeline · {data.cards.length} postulaciones activas</p>
      <div className="mt-8">
        <KanbanBoard initialData={data} />
      </div>
    </div>
  );
}
