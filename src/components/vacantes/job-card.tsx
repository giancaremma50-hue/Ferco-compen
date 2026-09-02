import Link from "next/link";
import type { JobListItem } from "@/lib/jobs/get-jobs";
import { JobStatusBadge } from "./job-status-badge";

// Sin pipeline todavía (nadie aprobó la vacante) — ahí sí hace falta el
// detalle clásico (aprobar/editar), no un tablero vacío. Un colaborador
// tampoco gestiona pipeline (AGENTS.md) — siempre va al detalle clásico,
// donde puede referir candidatos.
const NO_PIPELINE_YET = new Set(["borrador", "pendiente_aprobacion"]);

export function JobCard({ job, viewerRole }: { job: JobListItem; viewerRole: string }) {
  const href =
    viewerRole === "colaborador" || NO_PIPELINE_YET.has(job.status) ? `/vacantes/${job.id}` : `/vacantes/${job.id}/pipeline`;
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-4 border border-border bg-card px-5 py-4 transition-colors hover:border-foreground/30"
    >
      <div className="min-w-0">
        <p className="font-serif truncate text-lg">{job.title}</p>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {job.code} · {job.country ?? "Sin país"} · {job.headcount} {job.headcount === 1 ? "plaza" : "plazas"}
        </p>
      </div>
      <JobStatusBadge status={job.status} />
    </Link>
  );
}
