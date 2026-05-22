"use client";

import Link from "next/link";
import { Notification, NotificationType } from "@/types";
import { STAGE_MAP } from "@/constants/kanban";
import { ROUTES } from "@/constants/routes";
import { Bell, MessageSquare, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<NotificationType, string> = {
  new_request: "Nueva solicitud",
  stage_changed: "Cambio de estado",
  new_comment: "Nuevo comentario",
  comment_replied: "Respuesta a tu comentario",
};

function timeAgo(date: Date): string {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return "Hace un momento";
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)}h`;
  const d = Math.floor(diff / 86400);
  return `Hace ${d} día${d > 1 ? "s" : ""}`;
}

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const date = notification.createdAt?.toDate?.();
  const stageConfig = notification.newStage ? STAGE_MAP.get(notification.newStage) : null;

  const icon =
    notification.type === "new_comment" || notification.type === "comment_replied" ? (
      <MessageSquare className="h-4 w-4" />
    ) : (
      <Bell className="h-4 w-4" />
    );

  return (
    <Link
      href={ROUTES.SOLICITUD_DETALLE(notification.requestId)}
      onClick={() => onRead(notification.id)}
      className={cn(
        "flex gap-3 px-3 py-3 rounded-lg transition-colors cursor-pointer",
        notification.read
          ? "hover:bg-muted/50"
          : "bg-primary/5 hover:bg-primary/10"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-white",
          notification.read ? "bg-muted text-muted-foreground" : ""
        )}
        style={!notification.read ? { backgroundColor: "var(--gold)" } : {}}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground line-clamp-1">
            {TYPE_LABELS[notification.type]}
          </p>
          {!notification.read && (
            <span className="h-2 w-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: "var(--gold)" }} />
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-0.5">
          <span className="font-medium text-foreground/80">
            {notification.fromUserName}
          </span>{" "}
          ·{" "}
          <span className="font-mono">{notification.requestNumber}</span>
        </p>

        {stageConfig && (
          <div className="flex items-center gap-1 mt-1">
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <span className={cn("text-xs font-medium", stageConfig.color)}>
              {stageConfig.label}
            </span>
          </div>
        )}

        {notification.commentPreview && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">
            "{notification.commentPreview}"
          </p>
        )}

        {date && (
          <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo(date)}</p>
        )}
      </div>
    </Link>
  );
}
