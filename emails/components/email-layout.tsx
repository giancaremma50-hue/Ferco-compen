import { Html, Head, Body, Container, Text, Section, Hr, Link } from "@react-email/components";

/**
 * El pie NO invita a responder este correo: `sendEmail` no configura `replyTo`
 * y `EMAIL_FROM` es un remitente de plataforma, así que una respuesta no llega
 * a nadie. El canal para ejercer derechos vive en la política (sección 7) y es
 * el único que se nombra — un aviso legal que promete un buzón inexistente es
 * peor que no prometer nada.
 *
 * `privacyUrl` es opcional a propósito: solo los correos que llegan a un
 * candidato EXTERNO llevan el pie legal. En un correo interno (aprobación de
 * vacante, reporte de error) sería ruido — esa persona no es el titular de
 * los datos de los que habla la política.
 */
export function EmailLayout({
  platformName,
  privacyUrl,
  children,
}: {
  platformName: string;
  privacyUrl?: string;
  children: React.ReactNode;
}) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#faf9f7", fontFamily: "sans-serif", margin: 0, padding: "32px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", border: "1px solid #e4e1da", padding: "32px", maxWidth: 480 }}>
          <Text style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b6862" }}>
            {platformName}
          </Text>
          <Section style={{ marginTop: 16 }}>{children}</Section>
          {privacyUrl && (
            <>
              <Hr style={{ borderColor: "#e4e1da", marginTop: 28, marginBottom: 14 }} />
              <Text style={{ fontSize: 11, lineHeight: "1.6", color: "#6b6862", margin: 0 }}>
                Tratamos tus datos según nuestra{" "}
                <Link href={privacyUrl} style={{ color: "#6b6862", textDecoration: "underline" }}>
                  política de privacidad
                </Link>
                , donde también encontrarás cómo pedir acceso, corrección o eliminación de tu información.
              </Text>
            </>
          )}
        </Container>
      </Body>
    </Html>
  );
}
