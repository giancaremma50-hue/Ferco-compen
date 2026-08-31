import { Html, Head, Body, Container, Text, Section } from "@react-email/components";

export function EmailLayout({ platformName, children }: { platformName: string; children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#faf9f7", fontFamily: "sans-serif", margin: 0, padding: "32px 0" }}>
        <Container style={{ backgroundColor: "#ffffff", border: "1px solid #e4e1da", padding: "32px", maxWidth: 480 }}>
          <Text style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b6862" }}>
            {platformName}
          </Text>
          <Section style={{ marginTop: 16 }}>{children}</Section>
        </Container>
      </Body>
    </Html>
  );
}
