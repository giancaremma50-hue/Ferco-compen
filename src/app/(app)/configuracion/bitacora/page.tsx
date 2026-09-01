import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { getAuditLog } from "@/lib/audit/get-audit-log";

export default async function BitacoraPage() {
  const profile = await requireSuperAdmin();
  const entries = await getAuditLog(profile.organization_id);

  return (
    <div>
      <h2 className="font-serif text-[28px] leading-tight">Bitácora de auditoría</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Quién hizo qué, cuándo, y qué cambió. Últimas {entries.length} entradas.
      </p>

      {entries.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Todavía no hay nada registrado. Se llena sola con acciones sensibles — hoy, cambios de estado en
          reportes de soporte.
        </p>
      ) : (
        <div className="mt-6 border border-border bg-card">
          {entries.map((entry) => (
            <div key={entry.id} className="border-b border-border/60 p-4 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono rounded-sm bg-muted px-1.5 py-0.5">{entry.action}</span>
                <span className="text-muted-foreground">
                  {entry.entity_type}
                  {entry.entity_id && <span className="font-mono"> · {entry.entity_id.slice(0, 8)}</span>}
                </span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: es })}
                </span>
              </div>
              <p className="mt-1.5 text-sm">
                <span className="font-medium">{entry.actor?.display_name ?? "Sistema"}</span>
              </p>
              {entry.diff !== null && (
                <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-background p-2.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {JSON.stringify(entry.diff, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
