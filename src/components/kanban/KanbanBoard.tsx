"use client";

import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useRequests } from "@/hooks/useRequests";
import { updateRequestStage } from "@/lib/firebase/firestore";
import { STAGES } from "@/constants/kanban";
import { Stage } from "@/types";
import { KanbanColumn } from "./KanbanColumn";
import { Skeleton } from "@/components/ui/skeleton";

export function KanbanBoard() {
  const { userProfile } = useAuth();
  const { byStage, loading } = useRequests();
  const isAdmin = userProfile?.role === "administrador";

  async function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    if (!userProfile) return;

    const newStage = destination.droppableId as Stage;
    const currentRequests = byStage(source.droppableId as Stage);
    const request = currentRequests.find((r) => r.id === draggableId);
    if (!request) return;

    try {
      await updateRequestStage(
        draggableId,
        newStage,
        {
          createdBy: request.createdBy,
          requestNumber: request.requestNumber,
          detalleMovimiento: request.detalleMovimiento,
        },
        { uid: userProfile.uid, displayName: userProfile.displayName }
      );
    } catch {
      toast.error("No se pudo actualizar el estado. Inténtalo de nuevo.");
    }
  }

  if (loading) {
    return (
      <div className="flex gap-4 p-6 overflow-x-auto">
        {STAGES.map((s) => (
          <div key={s.id} className="min-w-[280px] space-y-3">
            <Skeleton className="h-12 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-4 p-6 overflow-x-auto pb-8">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            requests={byStage(stage.id)}
            isDraggable={isAdmin}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
