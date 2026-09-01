import { Text, Link } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

export function ReporteErrorEmail({
  platformName,
  reportCode,
  summary,
  reportUrl,
}: {
  platformName: string;
  reportCode: string;
  summary: string;
  reportUrl: string;
}) {
  return (
    <EmailLayout platformName={platformName}>
      <Text style={{ fontSize: 20, fontWeight: 600 }}>Reporte {reportCode}</Text>
      <Text>{summary}</Text>
      <Link href={reportUrl} style={{ color: "#1f4d3d" }}>
        Ver el hilo
      </Link>
    </EmailLayout>
  );
}
