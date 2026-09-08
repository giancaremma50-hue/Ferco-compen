import { Text } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

/** El cuerpo lo escribe quien recluta (libre o desde una plantilla) — se muestra tal cual, un párrafo por salto de línea. */
export function MensajeCandidatoEmail({
  platformName,
  privacyUrl,
  candidateName,
  body,
}: {
  platformName: string;
  privacyUrl: string;
  candidateName: string;
  body: string;
}) {
  return (
    <EmailLayout platformName={platformName} privacyUrl={privacyUrl}>
      <Text>Hola {candidateName},</Text>
      {/* \r\n: un <textarea> manda los saltos de línea así en el FormData — sin normalizar, cada línea salvo la última arrastra un \r suelto. */}
      {body.replace(/\r\n/g, "\n").split("\n").map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </EmailLayout>
  );
}
