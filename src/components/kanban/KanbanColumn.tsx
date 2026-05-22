"use client";

import { Droppable } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import { Request } from "@/types";
import { StageConfig } from "@/constants/kanban";
import { KanbanCard } from "./KanbanCard";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  stage: StageConfig;
  requests: Request[];
  isDraggable: boolean;
  showCreator?: boolean;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

export function KanbanColumn({ stage, requests, isDraggable, showCreator = false }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] w-full">
      {/* Column header */}
      <div className={cn("rounded-t-xl border border-b-0 px-4 py-3", stage.bgColor, stage.borderColor)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", stage.dotColor)} />
            <h2 className={cn("text-sm font-semibold", stage.color)}>
              {stage.label}
            </h2>
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              stage.bgColor,
              stage.color
            )}
          >
            {requests.length}
          </span>
        </div>
      </div>

      {/* Droppable zone */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 rounded-b-xl border border-t-0 p-3 min-h-[200px] transition-colors duration-200",
              stage.borderColor,
              snapshot.isDraggingOver
                ? "bg-accent/50"
                : "bg-muted/20"
            )}
          >
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-3"
            >
              {requests.map((request, index) => (
                <motion.div key={request.id} variants={itemVariants}>
                  <KanbanCard
                    request={request}
                    index={index}
                    isDraggable={isDraggable}
                    showCreator={showCreator}
                  />
                </motion.div>
              ))}
            </motion.div>
            {provided.placeholder}

            {requests.length === 0 && (
              <div className="flex items-center justify-center h-24 text-xs text-muted-foreground/60">
                Sin solicitudes
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
