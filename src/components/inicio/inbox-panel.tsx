import Link from "next/link";
import type { PendingRequest, MyRequest } from "@/lib/dashboard/get-inbox";
import { JobStatusBadge } from "@/components/vacantes/job-status-badge";

/** RH: bandeja de solicitudes por resolver. */
export function PendingApprovalsInbox({ requests }: { requests: PendingRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="border border-border bg-card p-5">
        <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Solicitudes pendientes</p>
        <p className="mt-2 text-sm text-muted-foreground">Sin solicitudes esperando aprobación.</p>
      </div>
    );
  }
  return (
    <div className="border border-border bg-card p-5">
      <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">
        Solicitudes pendientes <span className="tabular-nums">({requests.length})</span>
      </p>
      <div className="mt-3 divide-y divide-border/60">
        {requests.map((r) => (
          <Link key={r.id} href={`/vacantes/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-muted/30">
            <div className="min-w-0">
              <p className="truncate font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">
                {r.requestedByName ?? "—"}
                {r.departmentName && ` · ${r.departmentName}`}
              </p>
            </div>
            <span className="flex-none text-xs tabular-nums text-muted-foreground">
              {new Date(r.createdAt).toLocaleDateString("es", { dateStyle: "medium" })}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Gestor: en qué va lo que él mismo pidió. */
export function MyRequestsInbox({ requests }: { requests: MyRequest[] }) {
  if (requests.length === 0) {
    return (
      <div className="border border-border bg-card p-5">
        <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Mis solicitudes</p>
        <p className="mt-2 text-sm text-muted-foreground">Todavía no has solicitado ninguna vacante.</p>
        <Link href="/vacantes/nueva" className="mt-2 inline-block text-sm font-medium text-accent underline">
          Solicitar vacante
        </Link>
      </div>
    );
  }
  return (
    <div className="border border-border bg-card p-5">
      <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Mis solicitudes</p>
      <div className="mt-3 divide-y divide-border/60">
        {requests.map((r) => (
          <Link key={r.id} href={`/vacantes/${r.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:bg-muted/30">
            <p className="min-w-0 truncate font-medium">{r.title}</p>
            <JobStatusBadge status={r.status} />
          </Link>
        ))}
      </div>
    </div>
  );
}
