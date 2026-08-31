import { Text, Link } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

export function CambioEtapaEmail({
  platformName,
  candidateName,
  jobTitle,
  stageName,
  applicationUrl,
}: {
  platformName: string;
  candidateName: string;
  jobTitle: string;
  stageName: string;
  applicationUrl: string;
}) {
  return (
    <EmailLayout platformName={platformName}>
      <Text style={{ fontSize: 20, fontWeight: 600 }}>Cambio de etapa</Text>
      <Text>
        {candidateName} ({jobTitle}) pasó a la etapa <strong>{stageName}</strong>.
      </Text>
      <Link href={applicationUrl} style={{ color: "#1f4d3d" }}>
        Ver la postulación
      </Link>
    </EmailLayout>
  );
}
