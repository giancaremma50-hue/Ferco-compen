import "server-only";
import { createClient } from "@/lib/supabase/server";

/** RLS de Storage (cvs_privado_select) decide si el actor puede leer esta ruta. */
export async function getSignedCvUrl(cvFilePath: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("cvs-privado").createSignedUrl(cvFilePath, 60);
  if (error || !data) return null;
  return data.signedUrl;
}
