"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { SegmentSchema } from "./schema";

export type SegmentActionResult = { error?: string; success?: string };

export async function createSegment(
  _prevState: SegmentActionResult | undefined,
  formData: FormData,
): Promise<SegmentActionResult> {
  const profile = await requireProfile();
  const parsed = SegmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa el segmento." };

  const { name, ...filterFields } = parsed.data;
  const filters = Object.fromEntries(Object.entries(filterFields).filter(([, v]) => v !== undefined));

  const supabase = await createClient();
  const { error } = await supabase.from("candidate_segments").insert({
    organization_id: profile.organization_id,
    name,
    filters,
    created_by: profile.id,
  });
  if (error) return { error: "No se pudo guardar el segmento." };

  revalidatePath("/candidatos");
  return { success: "Segmento guardado" };
}

export async function deleteSegment(segmentId: string): Promise<void> {
  await requireProfile();
  const supabase = await createClient();
  // RLS bloquea el DELETE (no es el autor ni admin+) sin devolver error —
  // 0 filas afectadas se ve igual que "ya no existía". select().single()
  // convierte ese silencio en un error real en vez de un falso éxito.
  const { data, error } = await supabase.from("candidate_segments").delete().eq("id", segmentId).select("id").single();
  if (error || !data) throw new Error("No se pudo eliminar el segmento.");
  revalidatePath("/candidatos");
}
