import { Text, Link } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";
import { buildInterviewCalendarUrl } from "@/lib/interviews/calendar-link";

export function EntrevistaProgramadaEmail({
  platformName,
  privacyUrl,
  candidateName,
  jobTitle,
  scheduledAtIso,
  durationMinutes,
  location,
}: {
  platformName: string;
  privacyUrl: string;
  candidateName: string;
  jobTitle: string;
  scheduledAtIso: string;
  durationMinutes: number;
  location: string | null;
}) {
  // El correo se renderiza en el servidor (después de responder, vía
  // after()) — toLocaleString ahí usa la zona horaria del servidor, no la
  // del candidato, y no hay una zona horaria de organización guardada en
  // el esquema. Se muestra en UTC de forma explícita en vez de fingir una
  // hora local que podría estar mal por varias horas; el enlace de abajo
  // sí la ajusta correctamente a la zona de quien lo abre.
  const when = new Date(scheduledAtIso).toLocaleString("es", { dateStyle: "full", timeStyle: "short", timeZone: "UTC" });
  const calendarUrl = buildInterviewCalendarUrl(jobTitle, { scheduledAt: scheduledAtIso, durationMinutes, location });

  return (
    <EmailLayout platformName={platformName} privacyUrl={privacyUrl}>
      <Text style={{ fontSize: 20, fontWeight: 600 }}>Tienes una entrevista agendada</Text>
      <Text>
        Hola {candidateName}, se agendó tu entrevista para <strong>{jobTitle}</strong> el {when} (hora UTC)
        {location ? <> en {location}</> : null}.
      </Text>
      <Link href={calendarUrl} style={{ color: "#1f4d3d" }}>
        Agregar a Google Calendar
      </Link>
      <Text style={{ fontSize: 12, color: "#6b6862" }}>
        El enlace de arriba la muestra automáticamente en tu propia zona horaria.
      </Text>
    </EmailLayout>
  );
}
