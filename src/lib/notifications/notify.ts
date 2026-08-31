import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send-email";
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

  if (inAppEnabled) {
    await admin.from("notifications").insert({
      organization_id: input.organizationId,
      recipient_id: input.recipientId,
      type: input.type,
      title: input.title,
      body: input.body,
      url: input.url ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
    });
  }

  if (emailEnabled && input.email) {
    const { data: recipient } = await admin
      .from("profiles")
      .select("email")
      .eq("id", input.recipientId)
      .single();
    if (recipient) {
      await sendEmail({ to: recipient.email, subject: input.email.subject, react: input.email.react });
    }
  }
}
