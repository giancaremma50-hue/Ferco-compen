import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getErrorReport, getErrorReportMessages } from "@/lib/errors/get-error-reports";
import { ERROR_STATUS_LABEL } from "@/lib/errors/schema";
import { ErrorThread } from "@/components/errors/error-thread";

export default async function MiReportePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();

  const report = await getErrorReport(id, profile.organization_id);
  // reporter_id, no solo organization_id: un reporte de otra persona en la
  // misma organización no es "mío" solo porque comparto organización.
  if (!report || report.reporter_id !== profile.id) notFound();

  const messages = await getErrorReportMessages(report.id, profile.organization_id);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{report.code}</span>
          <span className="text-[11px] text-muted-foreground">{ERROR_STATUS_LABEL[report.status]}</span>
        </div>
        <h1 className="font-serif text-[28px] leading-tight">{report.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">«{report.user_message}»</p>
      </div>
      <ErrorThread reportId={report.id} messages={messages} currentProfileId={profile.id} />
    </div>
  );
}
