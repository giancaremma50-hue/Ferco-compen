import { Draggable } from "@hello-pangea/dnd";
import type { KanbanCard as KanbanCardData } from "@/lib/applications/get-applications";

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export function KanbanCard({
  card,
  index,
  onOpen,
}: {
  card: KanbanCardData;
  index: number;
  onOpen: (applicationId: string) => void;
}) {
  const days = daysSince(card.appliedAt);
  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <button
          type="button"
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onOpen(card.id)}
          className={`w-full border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-accent ${snapshot.isDragging ? "border-foreground/40" : ""}`}
        >
          <p className="font-medium">{card.candidateName}</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs tabular-nums text-muted-foreground">
              {days === 0 ? "Hoy" : days === 1 ? "1 día" : `${days} días`}
            </span>
            <span className="text-xs tabular-nums text-accent">
              {card.rating != null ? "★".repeat(card.rating) + "☆".repeat(5 - card.rating) : "sin calificar"}
            </span>
          </div>
        </button>
      )}
    </Draggable>
  );
}
