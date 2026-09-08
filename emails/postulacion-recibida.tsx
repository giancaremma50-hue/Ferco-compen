import { Text } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

/** Sin enlace a la app — el candidato no tiene cuenta, solo confirma que se recibió. */
export function PostulacionRecibidaEmail({
  platformName,
  privacyUrl,
  candidateName,
  jobTitle,
}: {
  platformName: string;
  privacyUrl: string;
  candidateName: string;
  jobTitle: string;
}) {
  return (
    <EmailLayout platformName={platformName} privacyUrl={privacyUrl}>
      <Text style={{ fontSize: 20, fontWeight: 600 }}>Recibimos tu postulación</Text>
      <Text>
        Hola {candidateName}, tu postulación a <strong>{jobTitle}</strong> quedó registrada. El equipo de
        reclutamiento la revisará y te contactará si avanzas en el proceso.
      </Text>
    </EmailLayout>
  );
}
