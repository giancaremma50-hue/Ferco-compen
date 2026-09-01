import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export async function getRejectionReasonsAdmin(organizationId: string): Promise<Tables<"rejection_reasons">[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rejection_reasons")
    .select("*")
    .eq("organization_id", organizationId)
    .order("label");
  return data ?? [];
}
