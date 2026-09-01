import { requireSuperAdmin } from "@/lib/auth/dal";
import { getErrorReportsList } from "@/lib/errors/get-error-reports";
import { ErrorReportListItem } from "@/components/errors/error-report-list-item";
import { STATUS_LABEL, SEVERITY_LABEL, STATUS_OPTIONS, SEVERITY_OPTIONS } from "@/lib/errors/status-labels";
import type { Database } from "@/lib/supabase/database.types";

type ErrorStatus = Database["public"]["Enums"]["error_status"];
type ErrorSeverity = Database["public"]["Enums"]["error_severity"];

export default async function ErroresPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string }>;
}) {
  await requireSuperAdmin();
  const { status, severity } = await searchParams;

  const validStatus = STATUS_OPTIONS.includes(status as ErrorStatus) ? (status as ErrorStatus) : undefined;
  const validSeverity = SEVERITY_OPTIONS.includes(severity as ErrorSeverity) ? (severity as ErrorSeverity) : undefined;

  const reports = await getErrorReportsList({ status: validStatus, severity: validSeverity });

  // Recibe los DOS valores explícitos (no un parche parcial): así "quitar
  // el filtro" (undefined) se distingue de "no tocar este filtro" — con
  // `next.status ?? validStatus` ambos casos se ven iguales y el pill
  // "Todos" nunca lograba limpiar el filtro activo.
  function filterHref(status: ErrorStatus | undefined, severity: ErrorSeverity | undefined) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (severity) params.set("severity", severity);
    const qs = params.toString();
    return qs ? `/configuracion/errores?${qs}` : "/configuracion/errores";
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Estado:</span>
        <a
          href={filterHref(undefined, validSeverity)}
          className={`rounded-full border px-2.5 py-1 text-xs ${!validStatus ? "border-foreground" : "border-border text-muted-foreground"}`}
        >
          Todos
        </a>
        {STATUS_OPTIONS.map((s) => (
          <a
            key={s}
            href={filterHref(s, validSeverity)}
            className={`rounded-full border px-2.5 py-1 text-xs ${validStatus === s ? "border-foreground" : "border-border text-muted-foreground"}`}
          >
            {STATUS_LABEL[s]}
          </a>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Severidad:</span>
        <a
          href={filterHref(validStatus, undefined)}
          className={`rounded-full border px-2.5 py-1 text-xs ${!validSeverity ? "border-foreground" : "border-border text-muted-foreground"}`}
        >
          Todas
        </a>
        {SEVERITY_OPTIONS.map((s) => (
          <a
            key={s}
            href={filterHref(validStatus, s)}
            className={`rounded-full border px-2.5 py-1 text-xs ${validSeverity === s ? "border-foreground" : "border-border text-muted-foreground"}`}
          >
            {SEVERITY_LABEL[s]}
          </a>
        ))}
      </div>

      {reports.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">Sin reportes con estos filtros.</p>
      ) : (
        <div className="mt-6 border border-border bg-card">
          {reports.map((r) => (
            <ErrorReportListItem key={r.id} item={r} href={`/configuracion/errores/${r.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
