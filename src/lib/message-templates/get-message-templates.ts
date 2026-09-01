import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type MessageTemplate = Pick<Tables<"message_templates">, "id" | "name" | "subject" | "body">;

/** Cualquier miembro de la organización puede leerlas (RLS: message_templates_select) — se usan al enviar un mensaje, no solo al administrarlas. */
export async function getMessageTemplates(organizationId: string): Promise<MessageTemplate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("message_templates")
    .select("id, name, subject, body")
    .eq("organization_id", organizationId)
    .order("name");
  return data ?? [];
}
