import type { JobStatus } from "@/lib/jobs/get-jobs";

const LABEL: Record<JobStatus, string> = {
  borrador: "Borrador",
  pendiente_aprobacion: "Pendiente de aprobación",
  abierta: "Abierta",
  pausada: "Pausada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

const STYLE: Record<JobStatus, string> = {
  borrador: "text-muted-foreground border-border",
  pendiente_aprobacion: "text-[#9A6B1F] border-[#9A6B1F]/40",
  abierta: "text-[#2F6F4E] border-[#2F6F4E]/40",
  pausada: "text-[#9A6B1F] border-[#9A6B1F]/40",
  cerrada: "text-muted-foreground border-border",
  cancelada: "text-[#B3261E] border-[#B3261E]/40",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`inline-flex h-6 shrink-0 items-center rounded-sm border px-2 text-xs ${STYLE[status]}`}>
      {LABEL[status]}
    </span>
  );
}
