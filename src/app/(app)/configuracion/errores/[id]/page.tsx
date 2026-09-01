import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/dal";
import { getErrorReportDetail } from "@/lib/errors/get-error-reports";
import { ErrorStatusControls } from "@/components/configuracion/error-status-controls";
import { ErrorReportThread } from "@/components/errors/error-report-thread";

export default async function ErrorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireSuperAdmin();
  const { id } = await params;
  const report = await getErrorReportDetail(id);
  if (!report) notFound();

  const catalogCode =
    report.context && typeof report.context === "object" && "code" in report.context
      ? (report.context as { code: string | null }).code
      : null;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs tabular-nums text-muted-foreground">{report.code}</p>
      <h1 className="font-serif mt-1 text-[28px] leading-tight">{report.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {report.reporterName ?? "Reportero anónimo (login fallido)"}
      </p>

      <div className="mt-4">
        <ErrorStatusControls reportId={report.id} status={report.status} severity={report.severity} />
      </div>

      <section className="mt-8">
        <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Qué intentaba hacer</h2>
        <p className="mt-2 text-sm leading-relaxed">{report.userMessage}</p>
      </section>

      <details className="mt-6 border border-border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium">Detalle técnico</summary>
        <dl className="mt-3 grid gap-2 text-xs text-muted-foreground">
          <div>
            <dt className="font-medium text-foreground">Código de catálogo</dt>
            <dd className="break-all">{catalogCode ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">URL</dt>
            <dd className="break-all">{report.url ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Mensaje técnico</dt>
            <dd className="break-all">{report.technicalDetail ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Stack / digest</dt>
            <dd className="break-all whitespace-pre-wrap">{report.stack ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Navegador</dt>
            <dd className="break-all">{report.userAgent ?? "—"}</dd>
          </div>
        </dl>
      </details>

      <ErrorReportThread reportId={report.id} messages={report.messages} currentProfileId={profile.id} />
    </div>
  );
}
