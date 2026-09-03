import type { FunnelData } from "@/lib/dashboard/get-funnel";

/**
 * Las cifras van como tira de números en el encabezado, sin tarjeta —
 * acompañan al saludo y dejan de competir por peso visual con la agenda,
 * que es la que pasó a ser protagonista (layout B, decisión del usuario
 * 2026-09-03). Son contexto, no la acción del día.
 */
export function FunnelKpiStrip({ data }: { data: FunnelData }) {
  const kpis: { label: string; value: string }[] = [
    { label: "Vacantes abiertas", value: String(data.openJobs) },
    { label: "Candidatos activos", value: String(data.activeCandidates) },
    { label: "Contrataciones (mes)", value: String(data.hiresThisMonth) },
    { label: "Días a contratación", value: data.avgDaysToHire == null ? "—" : String(data.avgDaysToHire) },
  ];

  return (
    <div className="flex flex-wrap gap-x-8 gap-y-4 sm:gap-x-10">
      {kpis.map((k) => (
        <div key={k.label}>
          <p className="text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase">{k.label}</p>
          <p className="font-serif mt-1 text-[28px] tabular-nums leading-none">{k.value}</p>
        </div>
      ))}
    </div>
  );
}

/** El embudo por etapa — se queda como tarjeta, debajo de la agenda y el buzón. */
export function FunnelKpis({ data }: { data: FunnelData }) {
  const maxCount = Math.max(1, ...data.byStageType.map((s) => s.count));
  return (
    <div className="border border-border bg-card p-5">
      <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Candidatos por etapa</p>
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
  );
}
