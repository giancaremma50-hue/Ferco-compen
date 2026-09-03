import type { RecruiterReport } from "@/lib/dashboard/get-recruiter-report";
import type { JobStatus } from "@/lib/jobs/get-jobs";

const STATUS_SHORT: Record<JobStatus, string> = {
  borrador: "Borrador",
  pendiente_aprobacion: "Pendiente",
  aceptada: "Aceptada",
  abierta: "Abierta",
  pausada: "Pausada",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

export function RecruiterReportSection({ report }: { report: RecruiterReport }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Informe por reclutador asignado</p>

      {report.rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Todavía no hay vacantes para reportar.</p>
      ) : (
        <div className="mt-3 overflow-x-auto border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
                <th className="px-4 py-2.5 font-normal">Reclutador asignado</th>
                <th className="px-4 py-2.5 font-normal">Vacantes por estado</th>
                <th className="px-4 py-2.5 text-right font-normal">Conversión</th>
                <th className="px-4 py-2.5 text-right font-normal">Días a contratación</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={row.ownerId ?? "sin-encargado"} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-2.5 font-medium">{row.ownerName}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {Object.entries(row.jobsByStatus)
                      .map(([status, count]) => `${count} ${STATUS_SHORT[status as JobStatus]}`)
                      .join(" · ")}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.conversionRate == null ? "—" : `${row.conversionRate}%`}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{row.avgDaysToHire == null ? "—" : row.avgDaysToHire}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {report.staleJobs.length > 0 && (
        <div className="mt-4 border border-border bg-card p-4">
          <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">
            Vacantes estancadas <span className="tabular-nums">(14+ días sin movimiento)</span>
          </p>
          <div className="mt-2 divide-y divide-border/60">
            {report.staleJobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0 truncate">{job.title}</span>
                <span className="flex-none text-xs text-muted-foreground">
                  {job.ownerName} · {job.daysSinceMovement} días
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
