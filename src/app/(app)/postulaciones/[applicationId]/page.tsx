import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

/**
 * El drawer del pipeline es la interfaz del candidato (decisión del usuario,
 * 2026-09-03). Esta ruta ya no dibuja pantalla — pero sigue viva como URL,
 * porque es el destino de todo enlace directo: las 3 notificaciones de
 * candidato, la tabla de Candidatos, los enlaces de la agenda de Inicio y el
 * correo de /api/postular. Redirige al pipeline con el candidato abierto.
 *
 * Antes esta página duplicaba el contenido del drawer con código aparte, y ya
 * habían divergido en un día: tenía rúbrica de competencias (eliminada del
 * proyecto), le faltaba la bitácora, y sus gates de permiso preguntaban por el
 * rol `colaborador` — extinto, así que la condición era siempre verdadera y
 * mostraba Contratar y Descartar a cualquiera con acceso a la vacante.
 */
export default async function ApplicationRedirectPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  await requireProfile();

  const supabase = await createClient();
  // RLS (applications_select) decide si este actor puede verla — un id que no
  // alcanza cae en notFound, no en un redirect a un pipeline que tampoco vería.
  const { data: application } = await supabase
    .from("applications")
    .select("job_id")
    .eq("id", applicationId)
    .maybeSingle();

  if (!application) notFound();

  redirect(`/vacantes/${application.job_id}/pipeline?candidato=${applicationId}`);
}
