"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MessageSquare, Paperclip, Calendar, User } from "lucide-react";
import { Request } from "@/types";
import { StageBadge } from "@/components/kanban/StageBadge";
import { ROUTES } from "@/constants/routes";
import { useNotifications } from "@/hooks/useNotifications";

const TIPO_LABELS: Record<string, string> = {
  incremento:       "Incremento salarial",
  promocion:        "Promoción",
  ajuste_salarial:  "Ajuste salarial",
  nueva_plaza:      "Nueva plaza",
  otro:             "Otro",
};

interface RequestCardProps {
  request: Request;
  showCreator?: boolean; // true in "Mi equipo" tab
}

export function RequestCard({ request, showCreator = false }: RequestCardProps) {
  const { notifications } = useNotifications();

  // Count unread notifications specifically for this request
  const unreadCount = notifications.filter(
    (n) => n.requestId === request.id && !n.read
  ).length;

  const date = request.createdAt?.toDate?.();
  const dateStr = date
    ? new Intl.DateTimeFormat("es-GT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date)
    : "";

  const tipoLabel =
    request.tipoMovimiento === "otro"
      ? `Otro: ${request.tipoMovimientoOtro ?? ""}`
      : TIPO_LABELS[request.tipoMovimiento] ?? request.tipoMovimiento;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2 }}
    >
      <Link href={ROUTES.SOLICITUD_DETALLE(request.id)}>
        <div className="rounded-xl border border-border bg-card p-5 cursor-pointer shadow-sm hover:shadow-md hover:shadow-black/5 transition-shadow duration-200 h-full flex flex-col">
          {/* Top row: number + unread badge + stage */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">
                {request.requestNumber}
              </span>
              {/* Unread seguimientos badge */}
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1 shrink-0"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </motion.span>
              )}
            </div>
            <StageBadge stage={request.stage} className="shrink-0" />
          </div>

          {/* Tipo de movimiento */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
            {tipoLabel}
          </p>

          {/* Creator name (team view only) */}
          {showCreator && request.creatorName && (
            <div className="flex items-center gap-1.5 mb-2">
              <User className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground font-medium truncate">
                {request.creatorName}
              </span>
            </div>
          )}

          {/* Main title */}
          <h3 className="text-sm font-medium text-foreground leading-snug mb-2 line-clamp-2 flex-1">
            {request.detalleMovimiento}
          </h3>

          {/* Person evaluated */}
          <p className="text-xs text-muted-foreground mb-4">
            <span className="font-medium text-foreground">
              {request.nombrePersonaEvaluar}
            </span>{" "}
            · {request.puestoPersonaEvaluar}
          </p>

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-3 mt-auto">
            <div className="flex items-center gap-3">
              {request.commentCount > 0 && (
                <span className="flex items-center gap-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {request.commentCount} seguimiento{request.commentCount !== 1 ? "s" : ""}
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
  );
}
