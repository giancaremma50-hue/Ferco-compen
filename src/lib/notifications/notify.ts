import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
import { getOrganization } from "@/lib/organizations/get-organization";
import { getSiteUrl } from "@/lib/site-url";
import type { Database } from "@/lib/supabase/database.types";
import type { ReactElement } from "react";

type NotificationType = Database["public"]["Enums"]["notification_type"];

export type NotifyInput = {
  organizationId: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  entityType?: string;
  entityId?: string;
  email?: { subject: string; react: ReactElement };
};

/**
 * Único punto de entrada para notificar a un usuario interno. SIEMPRE usa
 * el cliente admin: `notifications` no tiene política de INSERT para
 * `authenticated` (no es un descuido — casi nunca se notifica a uno mismo,
 * así que RLS lo niega por diseño) y aquí hay que leer la preferencia del
 * DESTINATARIO, no la del actor que disparó el evento.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const admin = createAdminClient();

  const { data: preference } = await admin
    .from("notification_preferences")
    .select("in_app, email")
    .eq("profile_id", input.recipientId)
    .eq("type", input.type)
    .maybeSingle();

  // Sin fila = tratado como habilitado (son los defaults de columna).
  const inAppEnabled = preference?.in_app ?? true;
  const emailEnabled = preference?.email ?? true;

  let notificationId: string | null = null;
  if (inAppEnabled) {
    const { data: row } = await admin
      .from("notifications")
      .insert({
        organization_id: input.organizationId,
        recipient_id: input.recipientId,
        type: input.type,
        title: input.title,
        body: input.body,
        url: input.url ?? null,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
      })
      .select("id")
      .single();
    notificationId = row?.id ?? null;
  }

  if (emailEnabled && input.email) {
    const { data: recipient } = await admin
      .from("profiles")
      .select("email")
      .eq("id", input.recipientId)
      .single();
    if (recipient) {
      const { error } = await sendEmail({
        to: recipient.email,
        subject: input.email.subject,
        react: input.email.react,
      });
      // Solo se marca email_sent_at cuando Resend de verdad confirmó el
      // envío — así "Centro de errores" (Fase 7) puede distinguir una
      // notificación cuyo correo nunca salió de una que sí.
      if (!error && notificationId) {
        await admin.from("notifications").update({ email_sent_at: new Date().toISOString() }).eq("id", notificationId);
      }
    }
  }
}

/**
 * Repetido en cada sitio que arma un correo (Fase 6): nombre de la
 * plataforma + URL del sitio, ninguno depende del otro — van en paralelo.
 */
export async function getEmailContext(): Promise<{ platformName: string; siteUrl: string }> {
  const [organization, siteUrl] = await Promise.all([getOrganization(), getSiteUrl()]);
  return { platformName: organization?.platform_name ?? "Reclutamiento", siteUrl };
}

/**
 * Envuelve una notificación best-effort para que corra con `after()` —
 * después de que la respuesta ya se envió, sin bloquearla ni arriesgarla —
 * y nunca deje escapar una excepción hacia la mutación que la disparó. Sin
 * esto, un fallo de red al insertar en `notifications` o al renderizar un
 * correo convertiría una Server Action ya exitosa (el job/postulación/
 * referido ya quedó guardado) en un error de cara al usuario.
 *
 * El catch sí registra el error (console.error): Vercel lo captura en los
 * logs de la función. No es "Centro de errores" (Fase 7, con bandeja y
 * aviso al super admin) — mientras tanto, es la única traza de que un
 * correo o una notificación in-app se perdió.
 */
export function notifyBestEffort(work: () => Promise<void>): void {
  after(async () => {
    try {
      await work();
    } catch (error) {
      console.error("notifyBestEffort: fallo al notificar", error);
    }
  });
}
