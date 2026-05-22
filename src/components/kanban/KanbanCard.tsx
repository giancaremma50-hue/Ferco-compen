"use client";

import { Draggable } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import Link from "next/link";
import { MessageSquare, Paperclip, Calendar } from "lucide-react";
import { Request } from "@/types";
import { StageBadge } from "./StageBadge";
import { ROUTES } from "@/constants/routes";

interface KanbanCardProps {
  request: Request;
  index: number;
  isDraggable: boolean;
}

export function KanbanCard({ request, index, isDraggable }: KanbanCardProps) {
  const date = request.createdAt?.toDate?.();
  const dateStr = date
    ? new Intl.DateTimeFormat("es-GT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date)
    : "";

  return (
    <Draggable
      draggableId={request.id}
      index={index}
      isDragDisabled={!isDraggable}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <motion.div
            whileHover={isDraggable ? { y: -2 } : {}}
            transition={{ duration: 0.15 }}
          >
            <Link href={ROUTES.SOLICITUD_DETALLE(request.id)}>
              <div
                className={`
                  rounded-xl border bg-card p-4 cursor-pointer select-none
                  transition-shadow duration-200
                  ${snapshot.isDragging
                    ? "shadow-xl shadow-black/10 rotate-1 border-primary/20"
                    : "border-border shadow-sm hover:shadow-md hover:shadow-black/5"
                  }
                `}
              >
                {/* Number + badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                    {request.requestNumber}
                  </span>
                  <StageBadge stage={request.stage} />
                </div>

                {/* Title */}
                <h3 className="text-sm font-medium text-foreground leading-snug mb-2 line-clamp-2">
                  {request.detalleMovimiento}
                </h3>

                {/* Person being evaluated */}
                <p className="text-xs text-muted-foreground mb-3">
                  <span className="font-medium text-foreground">
                    {request.nombrePersonaEvaluar}
                  </span>{" "}
                  · {request.puestoPersonaEvaluar}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {request.commentCount > 0 && (
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {request.commentCount}
                      </span>
                    )}
                    {request.attachments?.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Paperclip className="h-3.5 w-3.5" />
                        {request.attachments.length}
                      </span>
                    )}
                  </div>
                  {dateStr && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {dateStr}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </motion.div>
        </div>
      )}
    </Draggable>
  );
}
