import type { FunnelData } from "@/lib/dashboard/get-funnel";

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-border bg-card p-4">
      <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">{label}</p>
      <p className="font-serif mt-1.5 text-[28px] tabular-nums leading-none">{value}</p>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function FunnelKpis({ data }: { data: FunnelData }) {
  const maxCount = Math.max(1, ...data.byStageType.map((s) => s.count));
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Vacantes abiertas" value={String(data.openJobs)} />
        <Kpi label="Candidatos activos" value={String(data.activeCandidates)} />
        <Kpi label="Contrataciones (mes)" value={String(data.hiresThisMonth)} />
        <Kpi label="Días promedio a contratación" value={data.avgDaysToHire == null ? "—" : String(data.avgDaysToHire)} />
      </div>

      <div className="mt-4 border border-border bg-card p-4">
        <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Candidatos por etapa</p>
        <div className="mt-3 flex flex-col gap-2">
          {data.byStageType.map((s) => (
            <div key={s.type} className="flex items-center gap-3 text-sm">
              <span className="w-28 flex-none truncate text-muted-foreground">{s.label}</span>
              <div className="h-2 flex-1 bg-muted">
                <div className="h-2 bg-accent" style={{ width: `${(s.count / maxCount) * 100}%` }} />
              </div>
              <span className="w-6 flex-none text-right tabular-nums">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
