import Link from "next/link";
import type { AgendaData } from "@/lib/dashboard/get-agenda";

export function TodayAgenda({ data }: { data: AgendaData }) {
  if (data.interviews.length === 0 && data.tasks.length === 0) {
    return (
      <div className="border border-border bg-card p-5">
        <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Tu agenda de hoy</p>
        <p className="mt-2 text-sm text-muted-foreground">Sin entrevistas ni tareas pendientes por ahora.</p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card p-5">
      <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Tu agenda de hoy</p>

      {data.interviews.length > 0 && (
        <div className="mt-3 divide-y divide-border/60">
          {data.interviews.map((i) => (
            <Link key={i.id} href={`/postulaciones/${i.applicationId}`} className="flex items-center gap-3 py-2 text-sm hover:bg-muted/30">
              <span className="w-12 flex-none tabular-nums text-muted-foreground">
                {new Date(i.scheduledAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="min-w-0 flex-1 truncate">{i.candidateName}</span>
              <span className="flex-none text-xs text-muted-foreground">{i.jobTitle}</span>
            </Link>
          ))}
        </div>
      )}

      {data.tasks.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Tareas pendientes</p>
          <div className="mt-2 divide-y divide-border/60">
            {data.tasks.map((t) => (
              <Link key={t.id} href={`/postulaciones/${t.applicationId}`} className="flex items-center gap-3 py-2 text-sm hover:bg-muted/30">
                <span className="min-w-0 flex-1 truncate">{t.description}</span>
                <span className="flex-none text-xs text-muted-foreground">{t.candidateName}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
