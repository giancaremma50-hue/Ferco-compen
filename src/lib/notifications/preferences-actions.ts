"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type NotificationType = Database["public"]["Enums"]["notification_type"];
const ChannelSchema = z.enum(["in_app", "email"]);

export async function updatePreference(
  type: NotificationType,
  channel: "in_app" | "email",
  enabled: boolean,
): Promise<{ error?: string }> {
  const profile = await requireProfile();
  const parsedChannel = ChannelSchema.safeParse(channel);
  if (!parsedChannel.success) return { error: "Canal inválido." };

  const supabase = await createClient();
  // El objeto con clave computada rompe el excess-property check de
  // Supabase tipado (gotcha ya conocido, ver napkin) — se tipa explícito.
  const channelUpdate: Partial<Record<"in_app" | "email", boolean>> = { [parsedChannel.data]: enabled };
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ profile_id: profile.id, type, ...channelUpdate }, { onConflict: "profile_id,type" });

  if (error) return { error: "No se pudo guardar la preferencia." };
  revalidatePath("/mi-cuenta");
  return {};
}
