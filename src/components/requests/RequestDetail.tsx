"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/firestore";
import { Request } from "@/types";
import { StageBadge } from "@/components/kanban/StageBadge";
import { FileAttachmentList } from "./FileAttachmentList";
import { CommentThread } from "@/components/comments/CommentThread";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Globe, MapPin, Building, User } from "lucide-react";
import { STAGE_MAP } from "@/constants/kanban";
import { formatCurrency } from "@/constants/currency";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { motion } from "framer-motion";

const TIPO_LABELS: Record<string, string> = {
  incremento: "Incremento salarial",
  promocion: "Promoción",
  ajuste_salarial: "Ajuste salarial",
  nueva_plaza: "Nueva plaza",
  otro: "Otro",
};

interface RequestDetailProps {
  requestId: string;
}

export function RequestDetail({ requestId }: RequestDetailProps) {
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, "requests", requestId)).then((snap) => {
      if (snap.exists()) {
        setRequest({ id: snap.id, ...snap.data() } as Request);
      }
      setLoading(false);
    });
  }, [requestId]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground p-6">
        <p className="text-lg font-medium">Solicitud no encontrada</p>
        <Link href={ROUTES.DASHBOARD} className="text-sm mt-2 underline">
          Volver al tablero
        </Link>
      </div>
    );
  }

  const createdDate = request.createdAt?.toDate?.();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto p-6 space-y-6"
    >
      {/* Back */}
      <Link
        href={ROUTES.DASHBOARD}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al tablero
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div>
            <span className="text-xs font-mono text-muted-foreground">
              {request.requestNumber}
            </span>
            <h1 className="text-xl font-semibold text-foreground mt-1">
              {request.detalleMovimiento}
            </h1>
          </div>
          <StageBadge stage={request.stage} className="shrink-0" />
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>
            Solicitado por{" "}
            <span className="font-medium text-foreground">
              {request.creatorName}
            </span>
          </span>
          {createdDate && (
            <span>
              {new Intl.DateTimeFormat("es-GT", {
                dateStyle: "long",
              }).format(createdDate)}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-foreground border-b border-border pb-3">
              Detalles de la solicitud
            </h2>

            <InfoRow
              label="Tipo de movimiento"
              value={
                request.tipoMovimiento === "otro"
                  ? `Otro: ${request.tipoMovimientoOtro}`
                  : TIPO_LABELS[request.tipoMovimiento]
              }
            />

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <User className="h-3 w-3" /> Solicitante
                </p>
                <p className="text-sm font-medium">{request.nombreSolicitante}</p>
                <p className="text-xs text-muted-foreground">{request.puestoSolicitante}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <User className="h-3 w-3" /> Persona a evaluar
                </p>
                <p className="text-sm font-medium">{request.nombrePersonaEvaluar}</p>
                <p className="text-xs text-muted-foreground">{request.puestoPersonaEvaluar}</p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-3 sm:grid-cols-3">
              <InfoRow
                label="País"
                value={request.pais}
                icon={<Globe className="h-3 w-3" />}
              />
              <InfoRow
                label="Área"
                value={request.area}
                icon={<Building className="h-3 w-3" />}
              />
              {request.sucursal && (
                <InfoRow
                  label="Sucursal"
                  value={request.sucursal}
                  icon={<MapPin className="h-3 w-3" />}
                />
              )}
            </div>

            {/* Bonos */}
            {[1, 2, 3, 4, 5].some((n) => request[`bonoVariable${n}` as keyof Request]) && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Bonos variables
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((n) => {
                      const val = request[`bonoVariable${n}` as keyof Request];
                      if (!val) return null;
                      return (
                        <span
                          key={n}
                          className="rounded-lg bg-muted px-2.5 py-1 text-sm"
                        >
                          Bono {n}:{" "}
                          <span className="font-medium">
                            {formatCurrency(Number(val), request.pais)}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">
                Justificación
              </p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {request.justificacion}
              </p>
            </div>
          </div>

          {/* Comments */}
          <div className="rounded-xl border border-border bg-card p-6">
            <CommentThread
              requestId={requestId}
              requestNumber={request.requestNumber}
              requestTitle={request.detalleMovimiento}
              createdBy={request.createdBy}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Stage info */}
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3">
              Estado actual
            </p>
            <StageBadge stage={request.stage} />
            {request.stageChangedAt && (
              <p className="text-xs text-muted-foreground mt-2">
                Actualizado{" "}
                {new Intl.DateTimeFormat("es-GT", { dateStyle: "medium" }).format(
                  request.stageChangedAt.toDate()
                )}
              </p>
            )}
          </div>

          {/* Attachments */}
          {request.attachments?.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3">
                Archivos adjuntos ({request.attachments.length})
              </p>
              <FileAttachmentList attachments={request.attachments} />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
