import { Text, Link } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

export function VacantePendienteAprobacionEmail({
  platformName,
  jobTitle,
  jobUrl,
}: {
  platformName: string;
  jobTitle: string;
  jobUrl: string;
}) {
  return (
    <EmailLayout platformName={platformName}>
      <Text style={{ fontSize: 20, fontWeight: 600 }}>Vacante pendiente de aprobación</Text>
      <Text>
        <strong>{jobTitle}</strong> está esperando tu revisión.
      </Text>
      <Link href={jobUrl} style={{ color: "#1f4d3d" }}>
        Revisar la vacante
      </Link>
    </EmailLayout>
  );
}
