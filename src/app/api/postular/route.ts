import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { findOrCreateApplication } from "@/lib/jobs/create-application";

const ApplySchema = z.object({
  job_id: z.uuid({ error: "Vacante inválida." }),
  full_name: z.string().trim().min(3, { error: "Escribe tu nombre completo." }).max(120),
  email: z.email({ error: "Correo inválido." }),
  phone: z.string().trim().min(6, { error: "Escribe un teléfono válido." }).max(30),
  current_title: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().trim().max(120).optional(),
  ),
  years_experience: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z
      .number()
      .int({ error: "Revisa los años de experiencia." })
      .min(0, { error: "Revisa los años de experiencia." })
      .max(60, { error: "Revisa los años de experiencia." })
      .optional(),
  ),
});

const MAX_CV_BYTES = 10 * 1024 * 1024;
const ALLOWED_CV_TYPE = "application/pdf";

export async function POST(request: NextRequest) {
  // x-forwarded-for crece de izquierda a derecha con cada proxy que la
  // solicitud atraviesa; el cliente puede escribir libremente los primeros
  // valores para falsificar su IP, pero no el último — ese lo agrega el
  // borde de Vercel, el único salto en el que se puede confiar. Leer el
  // primer valor (como si fuera "el cliente") deja el rate limit inútil:
  // basta con mandar un valor distinto en cada request.
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = forwardedFor
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .pop() ?? "desconocida";
  if (!checkRateLimit(`postular:${ip}`, { max: 5, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera un minuto e inténtalo de nuevo." },
      { status: 429 },
    );
  }

  const formData = await request.formData();
  const parsed = ApplySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Revisa los datos del formulario." },
      { status: 400 },
    );
  }

  const cv = formData.get("cv");
  if (!(cv instanceof File) || cv.size === 0) {
    return NextResponse.json({ error: "Adjunta tu CV en PDF." }, { status: 400 });
  }
  if (cv.size > MAX_CV_BYTES) {
    return NextResponse.json(
      { error: "El CV pesa más de 10 MB. Comprímelo e inténtalo de nuevo." },
      { status: 400 },
    );
  }
  if (cv.type !== ALLOWED_CV_TYPE) {
    return NextResponse.json({ error: "El CV debe ser un archivo PDF." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("id, organization_id, status, is_public")
    .eq("id", parsed.data.job_id)
    .single();

  if (!job || job.status !== "abierta" || !job.is_public) {
    return NextResponse.json({ error: "Esta vacante ya no está disponible." }, { status: 404 });
  }

  const email = parsed.data.email.toLowerCase();
  const { data: existingCandidate } = await admin
    .from("candidates")
    .select("id")
    .eq("organization_id", job.organization_id)
    .eq("email", email)
    .maybeSingle();

  // Chequeo temprano: evita subir un CV que de todos modos se va a rechazar
  // por postulación duplicada.
  if (existingCandidate) {
    const { data: existingApplication } = await admin
      .from("applications")
      .select("id")
      .eq("job_id", job.id)
      .eq("candidate_id", existingCandidate.id)
      .maybeSingle();
    if (existingApplication) {
      return NextResponse.json(
        { error: "Ya tienes una postulación registrada para esta vacante." },
        { status: 409 },
      );
    }
  }

  const cvPath = `${job.organization_id}/${email}/${Date.now()}.pdf`;
  const { error: uploadError } = await admin.storage.from("cvs-privado").upload(cvPath, cv, {
    contentType: ALLOWED_CV_TYPE,
  });
  if (uploadError) {
    return NextResponse.json({ error: "No se pudo subir tu CV. Inténtalo de nuevo." }, { status: 500 });
  }

  const result = await findOrCreateApplication(
    admin,
    job.organization_id,
    job.id,
    {
      full_name: parsed.data.full_name,
      email,
      phone: parsed.data.phone,
      current_title: parsed.data.current_title ?? null,
      years_experience: parsed.data.years_experience ?? null,
      source: "portal",
      cv_file_path: cvPath,
    },
    existingCandidate?.id,
  );

  if ("error" in result) {
    await admin.storage.from("cvs-privado").remove([cvPath]);
    return NextResponse.json({ error: result.error }, { status: result.duplicate ? 409 : 500 });
  }

  if (!result.isNewCandidate) {
    // Candidato existente que vuelve a postular a otra vacante: el CV nuevo
    // pasa a ser el vigente en su perfil; el anterior queda en attachments.
    // Se actualiza solo hasta aquí, con la postulación ya confirmada — antes
    // de esto un fallo habría dejado cv_file_path apuntando a un archivo que
    // el rollback de arriba ya borró. Best-effort igual que el bloque de
    // abajo: si esto falla, la postulación y el attachment ya quedaron bien
    // registrados — el candidato solo se queda con el cv_file_path anterior
    // en su perfil hasta la próxima vez que actualice o postule de nuevo.
    await admin.from("candidates").update({ cv_file_path: cvPath }).eq("id", result.candidateId);
  }

  // Best-effort: la postulación en sí ya quedó registrada (lo que le importa
  // al candidato), así que un fallo aquí no debe convertir un éxito real en
  // un error de cara al usuario. El registro en attachments/timeline queda
  // incompleto en ese caso raro, no la postulación. Son dos escrituras
  // independientes entre sí — van en paralelo, no una tras otra.
  await Promise.all([
    admin.from("attachments").insert({
      organization_id: job.organization_id,
      candidate_id: result.candidateId,
      application_id: result.applicationId,
      file_path: cvPath,
      file_name: cv.name || "cv.pdf",
      file_size_bytes: cv.size,
      kind: "cv",
    }),
    admin.from("application_events").insert({
      organization_id: job.organization_id,
      application_id: result.applicationId,
      type: "postulacion_creada",
      payload: { origen: "portal" },
    }),
  ]);

  return NextResponse.json({ success: true }, { status: 201 });
}
