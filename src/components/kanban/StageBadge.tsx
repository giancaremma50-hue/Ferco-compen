"use client";

import { Stage } from "@/types";
import { STAGE_MAP } from "@/constants/kanban";
import { cn } from "@/lib/utils";

interface StageBadgeProps {
  stage: Stage;
  className?: string;
}

export function StageBadge({ stage, className }: StageBadgeProps) {
  const config = STAGE_MAP.get(stage);
  if (!config) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.bgColor,
        config.color,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dotColor)} />
      {config.label}
    </span>
  );
}
