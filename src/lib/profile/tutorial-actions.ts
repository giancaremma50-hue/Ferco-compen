"use server";

import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export async function markTutorialSeen(): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase.from("profiles").update({ has_seen_tutorial: true }).eq("id", profile.id);
}
