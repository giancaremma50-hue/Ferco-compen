"use client";

import { useState, useTransition } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { moveApplicationStage } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { KanbanColumn } from "./kanban-column";
import { CandidateDrawer } from "@/components/postulaciones/candidate-drawer";
import type { KanbanData } from "@/lib/applications/get-applications";

export function KanbanBoard({
  initialData,
  jobTitle,
  initialOpenApplicationId = null,
}: {
  initialData: KanbanData;
  jobTitle: string;
  /**
   * Candidato a abrir al entrar, desde `?candidato=` — se abre aunque su
   * tarjeta NO esté en el tablero: el kanban solo trae postulaciones
   * activas, así que un enlace viejo a alguien ya contratado o descartado
   * igual tiene que poder abrirse (el drawer pide sus propios datos por id).
   * En ese caso solo queda oculto "Siguiente etapa", que sí necesita la
   * etapa actual del tablero.
   */
  initialOpenApplicationId?: string | null;
}) {
  const [cards, setCards] = useState(initialData.cards);
  const [, startTransition] = useTransition();
  const [openApplicationId, setOpenApplicationId] = useState<string | null>(initialOpenApplicationId);

  function moveCard(applicationId: string, fromStageId: string, toStageId: string) {
    const previousCards = cards;
    setCards((current) => current.map((c) => (c.id === applicationId ? { ...c, stageId: toStageId } : c)));

    startTransition(async () => {
      const res = await moveApplicationStage(applicationId, fromStageId, toStageId);
      if (res.error) {
        setCards(previousCards);
        notifyError(res.error);
      } else {
        notifySuccess(res.success ?? "Etapa actualizada");
      }
    });
  }

  function handleDragEnd(result: DropResult) {
    const { draggableId, destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;
    moveCard(draggableId, source.droppableId, destination.droppableId);
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex h-full gap-4 overflow-x-auto pb-4">
          {initialData.stages.map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              cards={cards.filter((c) => c.stageId === stage.id)}
              onOpenCard={setOpenApplicationId}
            />
          ))}
        </div>
      </DragDropContext>

      <CandidateDrawer
        key={openApplicationId ?? "closed"}
        applicationId={openApplicationId}
        onClose={() => setOpenApplicationId(null)}
        jobTitle={jobTitle}
        stages={initialData.stages}
        currentStageId={cards.find((c) => c.id === openApplicationId)?.stageId ?? null}
        onStageChange={(applicationId, fromStageId, toStageId) => moveCard(applicationId, fromStageId, toStageId)}
        onDiscarded={(applicationId) => setCards((current) => current.filter((c) => c.id !== applicationId))}
      />
    </>
  );
}
