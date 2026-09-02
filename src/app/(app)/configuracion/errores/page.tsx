import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { getErrorReportsInbox, getErrorReportMessages } from "@/lib/errors/get-error-reports";
import { ERROR_STATUS_LABEL, ERROR_SEVERITY_LABEL } from "@/lib/errors/schema";
import { ErrorThread } from "@/components/errors/error-thread";
import { ErrorStatusActions } from "@/components/errors/error-status-actions";

// Función de módulo, no parte del cuerpo del componente — Date.now() ahí
// dispara react-hooks/purity aunque sea un Server Component sin estado.
function resolvedWithinDays(resolvedAt: string, days: number): boolean {
  return Date.now() - new Date(resolvedAt).getTime() < days * 86400_000;
}

const SEVERITY_CLASS: Record<string, string> = {
  critica: "bg-destructive/10 text-destructive",
  alta: "bg-destructive/10 text-destructive",
  media: "bg-warning/10 text-warning",
  baja: "bg-muted text-muted-foreground",
};

export default async function CentroErroresPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; filtro?: string }>;
}) {
  const profile = await requireSuperAdmin();
  const { id, filtro = "sin_resolver" } = await searchParams;

  const reports = await getErrorReportsInbox(profile.organization_id);
  const sinAbrir = reports.filter((r) => r.status === "nuevo").length;
  const enRevision = reports.filter((r) => r.status === "en_revision" || r.status === "esperando_usuario").length;
  const resueltos30d = reports.filter(
    (r) => r.status === "resuelto" && r.resolved_at && resolvedWithinDays(r.resolved_at, 30),
  ).length;

  const filtered = reports.filter((r) => {
    if (filtro === "criticos") return r.severity === "critica" || r.severity === "alta";
    if (filtro === "todos") return true;
    return r.status !== "resuelto" && r.status !== "descartado";
  });

  const selected = id ? reports.find((r) => r.id === id) : filtered[0];
  const messages = selected ? await getErrorReportMessages(selected.id, profile.organization_id) : [];

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="font-serif text-[28px] leading-tight">Centro de errores</h2>
          <p className="mt-1 text-sm text-muted-foreground">Lo que se rompió, quién lo vivió, y la conversación para resolverlo.</p>
        </div>
        <div className="flex items-center gap-6 text-right">
          <div>
            <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Sin abrir</p>
            <p className="font-serif text-[26px] tabular-nums text-destructive">{sinAbrir}</p>
          </div>
          <div>
            <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">En revisión</p>
            <p className="font-serif text-[26px] tabular-nums">{enRevision}</p>
          </div>
          <div>
            <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Resueltos (30d)</p>
            <p className="font-serif text-[26px] tabular-nums text-muted-foreground">{resueltos30d}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[380px_1fr] gap-6">
        <div className="border border-border bg-card">
          <div className="flex gap-1.5 border-b border-border p-3">
            {[
              { key: "sin_resolver", label: "Sin resolver" },
              { key: "todos", label: "Todos" },
              { key: "criticos", label: "Críticos" },
            ].map((f) => (
              <Link
                key={f.key}
                href={`/configuracion/errores?filtro=${f.key}`}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  filtro === f.key ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">
              No hay reportes en «{filtro === "sin_resolver" ? "Sin resolver" : filtro === "criticos" ? "Críticos" : "Todos"}».{" "}
              {filtro !== "todos" && (
                <Link href="/configuracion/errores?filtro=todos" className="text-foreground underline">
                  Ver todos
                </Link>
              )}
            </p>
          )}
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/configuracion/errores?filtro=${filtro}&id=${r.id}`}
              className={`flex flex-col gap-1.5 border-b border-border/60 p-4 text-left ${
                selected?.id === r.id ? "bg-muted" : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${SEVERITY_CLASS[r.severity]}`}>
                  {ERROR_SEVERITY_LABEL[r.severity]}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">{r.code}</span>
                <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true, locale: es })}
                </span>
              </div>
              <p className="text-sm font-medium leading-tight">{r.title}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {r.reporter?.display_name ?? "Anónimo"} · «{r.user_message}»
              </p>
              <span className="text-[11px] text-muted-foreground">{ERROR_STATUS_LABEL[r.status]}</span>
            </Link>
          ))}
        </div>

        <div className="border border-border bg-card">
          {!selected ? (
            <p className="p-8 text-sm text-muted-foreground">Elige un reporte de la lista.</p>
          ) : (
            <>
              <div className="border-b border-border p-6">
                <div className="mb-3 flex items-center gap-2">
                  <span className={`rounded-sm px-1.5 py-0.5 text-[11px] font-medium ${SEVERITY_CLASS[selected.severity]}`}>
                    {ERROR_SEVERITY_LABEL[selected.severity]}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">{selected.code}</span>
                  <div className="ml-auto">
                    <ErrorStatusActions reportId={selected.id} status={selected.status} />
                  </div>
                </div>
                <h3 className="font-serif text-[24px] leading-tight">{selected.title}</h3>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Reportado por <strong className="font-medium text-foreground">{selected.reporter?.display_name ?? "Anónimo"}</strong> ·{" "}
                  {new Date(selected.created_at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>

              {(selected.url || selected.user_agent || selected.technical_detail) && (
                <div className="border-b border-border bg-background/60 p-6">
                  <p className="mb-3 text-[11px] tracking-[0.13em] text-muted-foreground uppercase">
                    Contexto capturado automáticamente
                  </p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs">
                    {selected.url && (
                      <div className="flex gap-3">
                        <span className="w-16 text-muted-foreground">Ruta</span>
                        <span className="truncate font-mono">{selected.url}</span>
                      </div>
                    )}
                    {selected.user_agent && (
                      <div className="flex gap-3">
                        <span className="w-16 text-muted-foreground">Navegador</span>
                        <span className="truncate font-mono">{selected.user_agent}</span>
                      </div>
                    )}
                  </div>
                  {selected.technical_detail && (
                    <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-card p-3 font-mono text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                      {selected.technical_detail}
                    </pre>
                  )}
                </div>
              )}

              <div className="p-6">
                <ErrorThread reportId={selected.id} messages={messages} currentProfileId={profile.id} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
