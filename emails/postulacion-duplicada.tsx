import { Text } from "@react-email/components";
import { EmailLayout } from "./components/email-layout";

/**
 * "Ya habías postulado a esta vacante", y va SOLO por correo.
 *
 * Existe por seguridad, no por cortesía. Antes la API respondía 409 con ese
 * mensaje, y como `/api/postular` es anónimo eso era un oráculo: probando
 * correos contra un `job_id` público se podía confirmar quién había postulado
 * a qué puesto — el dato "está buscando trabajo", el más sensible de un ATS.
 *
 * Ahora la API responde igual que ante una postulación nueva y el aviso llega
 * acá: solo lo lee quien de verdad tiene ese buzón. Ver docs/PENDIENTE.md
 * (decisión del usuario, 2026-09-08) y el comentario en el route.
 */
export function PostulacionDuplicadaEmail({
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
      <Text style={{ fontSize: 20, fontWeight: 600 }}>Ya tenías una postulación aquí</Text>
      <Text>
        Hola {candidateName}, recibimos un envío para <strong>{jobTitle}</strong>, pero tu postulación a esa vacante ya
        estaba registrada de antes. No hicimos nada nuevo: la que ya tenías sigue en el proceso, con los archivos que
        habías enviado.
      </Text>
      <Text>
        Si no fuiste tú quien intentó postular ahora, no hay nada que tengas que hacer — no se cambió ni se agregó nada
        a tu candidatura.
      </Text>
    </EmailLayout>
  );
}
