import "server-only";
import { Resend } from "resend";
import type { ReactElement } from "react";

/**
 * `new Resend(...)` lanza de inmediato si la key llega vacía — construirlo
 * a nivel de módulo rompería el build entero en cuanto CUALQUIER página
 * importara (aunque sea indirectamente, vía una Server Action) este
 * archivo, incluso en entornos donde Resend todavía no está configurado.
 * Se crea solo la primera vez que de verdad se va a mandar un correo, y se
 * reutiliza después — no hay razón para instanciarlo en cada envío.
 */
let resendClient: Resend | undefined;
function getResendClient(): Resend {
  return (resendClient ??= new Resend(process.env.RESEND_API_KEY));
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<{ error?: string }> {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: input.to,
    subject: input.subject,
    react: input.react,
  });
  if (error) return { error: "No se pudo enviar el correo." };
  return {};
}
