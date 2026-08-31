import { Text, Link } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

export function MovimientoReferidoEmail({
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
      <Text style={{ fontSize: 20, fontWeight: 600 }}>Tu referido avanzó</Text>
      <Text>
        {candidateName}, a quien referiste para <strong>{jobTitle}</strong>, ahora está en la etapa{" "}
        <strong>{stageName}</strong>.
      </Text>
      <Link href={applicationUrl} style={{ color: "#1f4d3d" }}>
        Ver el avance
      </Link>
    </EmailLayout>
  );
}
