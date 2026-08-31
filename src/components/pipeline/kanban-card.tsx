import Link from "next/link";
import { Draggable } from "@hello-pangea/dnd";
import type { KanbanCard as KanbanCardData } from "@/lib/applications/get-applications";

export function KanbanCard({ card, index }: { card: KanbanCardData; index: number }) {
  return (
    <Draggable draggableId={card.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`border border-border bg-card px-3 py-2.5 text-sm ${snapshot.isDragging ? "border-foreground/40" : ""}`}
        >
          <Link href={`/postulaciones/${card.id}`} className="block">
            <p className="font-medium">{card.candidateName}</p>
            {card.rating != null && (
              <p className="mt-1 text-xs tabular-nums text-muted-foreground">★ {card.rating}</p>
            )}
          </Link>
        </div>
      )}
    </Draggable>
  );
}
