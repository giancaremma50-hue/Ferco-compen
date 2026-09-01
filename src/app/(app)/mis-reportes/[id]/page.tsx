import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getMyReportDetail } from "@/lib/errors/get-my-reports";
import { STATUS_LABEL } from "@/lib/errors/status-labels";
import { ErrorReportThread } from "@/components/errors/error-report-thread";

export default async function MyReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  // getMyReportDetail no filtra por reporter_id explícitamente porque RLS
  // (error_reports_select) ya lo hace — si vuelve null, es "no existe" o
  // "no es tuyo", y ambos casos deben verse igual desde afuera.
  const report = await getMyReportDetail(id);
  if (!report) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs tabular-nums text-muted-foreground">{report.code}</p>
      <h1 className="font-serif mt-1 text-[28px] leading-tight">{report.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Estado: {STATUS_LABEL[report.status]}</p>

      <section className="mt-8">
        <h2 className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Qué le contaste al soporte</h2>
        <p className="mt-2 text-sm leading-relaxed">{report.userMessage}</p>
      </section>

      <ErrorReportThread reportId={report.id} messages={report.messages} currentProfileId={profile.id} />
    </div>
  );
}
