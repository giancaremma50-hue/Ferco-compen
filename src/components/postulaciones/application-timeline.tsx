import type { ApplicationEvent } from "@/lib/applications/get-applications";

const EVENT_LABEL: Record<ApplicationEvent["type"], (e: ApplicationEvent) => string> = {
  postulacion_creada: () => "Postulación recibida",
  etapa_cambiada: () => "Cambió de etapa",
  nota_agregada: (e) => (e.payload.is_private ? "Agregó una nota privada" : "Agregó una nota"),
  correo_enviado: () => "Se envió un correo",
  adjunto_agregado: () => "Se agregó un adjunto",
  calificacion_cambiada: (e) => `Calificación: ${e.payload.rating ?? "sin calificar"}`,
  rechazada: () => "Postulación rechazada",
};

export function ApplicationTimeline({ events }: { events: ApplicationEvent[] }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">Sin actividad todavía.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {events.map((e) => (
        <li key={e.id} className="border-l-2 border-border pl-3 text-sm">
          <p>{EVENT_LABEL[e.type](e)}</p>
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
            {e.actorName ?? "Sistema"} · {new Date(e.createdAt).toLocaleString("es-GT")}
          </p>
        </li>
      ))}
    </ol>
  );
}
