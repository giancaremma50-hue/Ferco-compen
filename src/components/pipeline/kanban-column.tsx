import { Droppable } from "@hello-pangea/dnd";
import { KanbanCard } from "./kanban-card";
import type { KanbanStage, KanbanCard as KanbanCardData } from "@/lib/applications/get-applications";

export function KanbanColumn({
  stage,
  cards,
  onOpenCard,
}: {
  stage: KanbanStage;
  cards: KanbanCardData[];
  onOpenCard: (applicationId: string) => void;
}) {
  return (
    <div className="flex h-full min-w-[240px] max-w-[420px] flex-1 flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <p className="text-[11px] tracking-[0.1em] text-muted-foreground uppercase">{stage.name}</p>
        <span className="text-xs tabular-nums text-muted-foreground">{cards.length}</span>
      </div>
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex flex-1 min-h-24 flex-col gap-2 overflow-y-auto rounded-md border border-border bg-background p-2 ${snapshot.isDraggingOver ? "border-foreground/30" : ""}`}
          >
            {cards.map((card, index) => (
              <KanbanCard key={card.id} card={card} index={index} onOpen={onOpenCard} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
