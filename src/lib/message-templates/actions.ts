"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOrAbove } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { MessageTemplateSchema } from "./schema";

export type MessageTemplateActionResult = { error?: string; success?: string };

export async function createMessageTemplate(
  _prevState: MessageTemplateActionResult | undefined,
  formData: FormData,
): Promise<MessageTemplateActionResult> {
  const profile = await requireAdminOrAbove();
  const parsed = MessageTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa la plantilla." };

  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").insert({
    organization_id: profile.organization_id,
    name: parsed.data.name,
    subject: parsed.data.subject,
    body: parsed.data.body,
  });
  if (error) return { error: "No se pudo crear la plantilla." };

  revalidatePath("/configuracion/plantillas-mensaje");
  return { success: "Plantilla creada" };
}

export async function updateMessageTemplate(
  templateId: string,
  _prevState: MessageTemplateActionResult | undefined,
  formData: FormData,
): Promise<MessageTemplateActionResult> {
  await requireAdminOrAbove();
  const parsed = MessageTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa la plantilla." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("message_templates")
    .update({ name: parsed.data.name, subject: parsed.data.subject, body: parsed.data.body })
    .eq("id", templateId);
  if (error) return { error: "No se pudo actualizar la plantilla." };

  revalidatePath("/configuracion/plantillas-mensaje");
  return { success: "Plantilla actualizada" };
}

export async function deleteMessageTemplate(templateId: string): Promise<void> {
  await requireAdminOrAbove();
  const supabase = await createClient();
  const { error } = await supabase.from("message_templates").delete().eq("id", templateId);
  if (error) throw new Error("No se pudo eliminar la plantilla.");
  revalidatePath("/configuracion/plantillas-mensaje");
}
