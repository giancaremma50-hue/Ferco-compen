import { Text, Link } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

/**
 * Un solo correo para todos los cambios de estado de una vacante (aceptada,
 * devuelta, publicada, pausada, reabierta, cerrada, cancelada) — el título y
 * la frase los arma quien notifica, así no hace falta una plantilla por
 * estado que diría casi lo mismo.
 */
export function VacanteCambioEstadoEmail({
  platformName,
  heading,
  jobTitle,
  message,
  reason,
  jobUrl,
}: {
  platformName: string;
  heading: string;
  jobTitle: string;
  message: string;
  /** Motivo de la devolución — solo viaja cuando RH devuelve la solicitud. */
  reason?: string | null;
  jobUrl: string;
}) {
  return (
    <EmailLayout platformName={platformName}>
      <Text style={{ fontSize: 20, fontWeight: 600 }}>{heading}</Text>
      <Text>
        <strong>{jobTitle}</strong> {message}
      </Text>
      {reason ? (
        <Text style={{ borderLeft: "3px solid #1f4d3d", paddingLeft: 12, color: "#444440" }}>
          <strong>Motivo:</strong> {reason}
        </Text>
      ) : null}
      <Link href={jobUrl} style={{ color: "#1f4d3d" }}>
        Ver la vacante
      </Link>
    </EmailLayout>
  );
}
