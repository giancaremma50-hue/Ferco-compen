import { Text, Link } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

export function NuevaPostulacionEmail({
  platformName,
  candidateName,
  jobTitle,
  applicationUrl,
}: {
  platformName: string;
  candidateName: string;
  jobTitle: string;
  applicationUrl: string;
}) {
  return (
    <EmailLayout platformName={platformName}>
      <Text style={{ fontSize: 20, fontWeight: 600 }}>Nueva postulación</Text>
      <Text>
        {candidateName} acaba de postular a <strong>{jobTitle}</strong>.
      </Text>
      <Link href={applicationUrl} style={{ color: "#1f4d3d" }}>
        Ver la postulación
      </Link>
    </EmailLayout>
  );
}
