import { requireProfile } from "@/lib/auth/dal";
import { getMyReports } from "@/lib/errors/get-my-reports";
import { ErrorReportListItem } from "@/components/errors/error-report-list-item";

export default async function MisReportesPage() {
  await requireProfile();
  const reports = await getMyReports();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-[32px]">Mis reportes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Lo que le has contado al soporte y su seguimiento.
      </p>

      {reports.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          Todavía no has reportado nada — cuando algo falle, verás aquí el hilo con soporte.
        </p>
      ) : (
        <div className="mt-8 border border-border bg-card">
          {reports.map((r) => (
            <ErrorReportListItem key={r.id} item={r} href={`/mis-reportes/${r.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
