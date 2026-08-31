"use client";

import { useState, useTransition } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { moveApplicationStage } from "@/lib/applications/actions";
import { notifyError } from "@/lib/notifications/toast";
import { KanbanColumn } from "./kanban-column";
import type { KanbanData } from "@/lib/applications/get-applications";

export function KanbanBoard({ initialData }: { initialData: KanbanData }) {
  const [cards, setCards] = useState(initialData.cards);
  const [, startTransition] = useTransition();

  function handleDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const toStageId = destination.droppableId;
    const fromStageId = source.droppableId;
    const previousCards = cards;

    // Optimista: la tarjeta se ve en su nueva columna de inmediato.
    setCards((current) => current.map((c) => (c.id === draggableId ? { ...c, stageId: toStageId } : c)));

    startTransition(async () => {
      const res = await moveApplicationStage(draggableId, fromStageId, toStageId);
      if (res.error) {
        setCards(previousCards);
        notifyError(res.error);
      }
    });
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {initialData.stages.map((stage) => (
          <KanbanColumn key={stage.id} stage={stage} cards={cards.filter((c) => c.stageId === stage.id)} />
        ))}
      </div>
    </DragDropContext>
  );
}
