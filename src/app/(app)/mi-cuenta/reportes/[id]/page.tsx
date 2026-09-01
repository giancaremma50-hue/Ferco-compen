import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getErrorReport, getErrorReportMessages } from "@/lib/errors/get-error-reports";
import { ERROR_STATUS_LABEL } from "@/lib/errors/schema";
import { ErrorThread } from "@/components/errors/error-thread";

export default async function MiReportePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;

  // getErrorReport ya acota por organización (defensa contra el hueco de
  // RLS documentado en get-error-reports.ts). Este chequeo adicional cubre
  // el otro eje: dueño vs. ajeno dentro de la MISMA organización.
  const report = await getErrorReport(id, profile.organization_id);
  if (!report || (report.reporter_id !== profile.id && profile.role !== "super_admin")) notFound();

  const messages = await getErrorReportMessages(id, profile.organization_id);

  return (
    <div className="mx-auto max-w-xl">
      <Link href="/mi-cuenta" className="text-sm text-muted-foreground hover:text-foreground">
        ← Mi cuenta
      </Link>
      <div className="mt-4 border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{report.code}</span>
          <span className="ml-auto text-xs text-muted-foreground">{ERROR_STATUS_LABEL[report.status]}</span>
        </div>
        <h1 className="mt-2 font-serif text-[26px] leading-tight">{report.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">«{report.user_message}»</p>

        <div className="mt-6">
          <ErrorThread reportId={report.id} messages={messages} currentProfileId={profile.id} />
        </div>
      </div>
    </div>
  );
}
