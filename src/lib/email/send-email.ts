import "server-only";
import { Resend } from "resend";
import type { ReactElement } from "react";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(input: {
  to: string;
  subject: string;
  react: ReactElement;
}): Promise<{ error?: string }> {
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: input.to,
    subject: input.subject,
    react: input.react,
  });
  if (error) return { error: "No se pudo enviar el correo." };
  return {};
}
