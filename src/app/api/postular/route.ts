import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  findOrCreateCandidate,
  createApplicationForCandidate,
  rollbackIfNewCandidate,
} from "@/lib/jobs/create-application";
import { notify, notifyBestEffort, getEmailContext } from "@/lib/notifications/notify";
import { zodFieldError } from "@/lib/forms/zod-error";
import { sendEmail } from "@/lib/email/send-email";
import { NuevaPostulacionEmail } from "@/emails/nueva-postulacion";
import { PostulacionRecibidaEmail } from "@/emails/postulacion-recibida";

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
    return NextResponse.json(zodFieldError(parsed.error), { status: 400 });
  }

  const cv = formData.get("cv");
  if (!(cv instanceof File) || cv.size === 0) {
    return NextResponse.json({ error: "Adjunta tu CV en PDF.", field: "cv" }, { status: 400 });
  }
  if (cv.size > MAX_CV_BYTES) {
    return NextResponse.json(
      { error: "El CV pesa más de 10 MB. Comprímelo e inténtalo de nuevo.", field: "cv" },
      { status: 400 },
    );
  }
  if (cv.type !== ALLOWED_CV_TYPE) {
    return NextResponse.json({ error: "El CV debe ser un archivo PDF.", field: "cv" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("id, organization_id, status, is_public, title, owner_id, requested_by")
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

  // El candidato se resuelve/crea ANTES de subir el CV: cvs_privado_select
  // (política de Storage) exige que el segundo segmento de la ruta sea el
  // candidate_id — subir primero y crear el candidato después dejaría el
  // archivo en una ruta que ninguna política de lectura puede evaluar.
  const candidateResult = await findOrCreateCandidate(
    job.organization_id,
    {
      full_name: parsed.data.full_name,
      email,
      phone: parsed.data.phone,
      current_title: parsed.data.current_title ?? null,
      years_experience: parsed.data.years_experience ?? null,
      source: "portal",
    },
    existingCandidate?.id,
  );

  if ("error" in candidateResult) {
    return NextResponse.json({ error: candidateResult.error }, { status: 500 });
  }
  const { candidateId, isNewCandidate } = candidateResult;

  const cvPath = `${job.organization_id}/${candidateId}/${Date.now()}.pdf`;
  const { error: uploadError } = await admin.storage.from("cvs-privado").upload(cvPath, cv, {
    contentType: ALLOWED_CV_TYPE,
  });
  if (uploadError) {
    await rollbackIfNewCandidate(candidateId, isNewCandidate);
    return NextResponse.json({ error: "No se pudo subir tu CV. Inténtalo de nuevo." }, { status: 500 });
  }

  const applicationResult = await createApplicationForCandidate(
    admin,
    job.organization_id,
    job.id,
    candidateId,
    isNewCandidate,
  );

  if ("error" in applicationResult) {
    await admin.storage.from("cvs-privado").remove([cvPath]);
    return NextResponse.json(
      { error: applicationResult.error },
      { status: applicationResult.duplicate ? 409 : 500 },
    );
  }

  // El CV nuevo pasa a ser el vigente en el perfil; si ya tenía uno de una
  // postulación anterior, queda igual en attachments (no se borra). Best
  // effort: si esto falla, la postulación y el attachment de abajo ya
  // quedaron bien registrados — el candidato solo se queda con el
  // cv_file_path anterior en su perfil hasta la próxima vez que postule.
  await admin.from("candidates").update({ cv_file_path: cvPath }).eq("id", candidateId);

  // Best-effort: la postulación en sí ya quedó registrada (lo que le importa
  // al candidato), así que un fallo aquí no debe convertir un éxito real en
  // un error de cara al usuario. El registro en attachments/timeline queda
  // incompleto en ese caso raro, no la postulación. Son dos escrituras
  // independientes entre sí — van en paralelo, no una tras otra.
  await Promise.all([
    admin.from("attachments").insert({
      organization_id: job.organization_id,
      candidate_id: candidateId,
      application_id: applicationResult.applicationId,
      file_path: cvPath,
      file_name: cv.name || "cv.pdf",
      file_size_bytes: cv.size,
      kind: "cv",
    }),
    admin.from("application_events").insert({
      organization_id: job.organization_id,
      application_id: applicationResult.applicationId,
      type: "postulacion_creada",
      payload: { origen: "portal" },
    }),
  ]);

  // Best-effort, corre con after() DESPUÉS de responder: la postulación ya
  // quedó completa arriba, así que ninguna de las dos debe demorar ni
  // arriesgar la respuesta 201 (mandar el correo implica una llamada de red
  // a Resend más el render de React Email — no algo para bloquear la
  // respuesta al candidato). La del candidato es un correo directo con
  // sendEmail(), no notify() — el candidato no tiene perfil ni fila en
  // `notifications`, esa tabla es solo para usuarios internos.
  const jobOwnerId = job.owner_id ?? job.requested_by;
  notifyBestEffort(async () => {
    const { platformName, siteUrl } = await getEmailContext();
    const applicationUrl = `${siteUrl}/postulaciones/${applicationResult.applicationId}`;
    await Promise.all([
      sendEmail({
        to: email,
        subject: "Recibimos tu postulación",
        react: PostulacionRecibidaEmail({ platformName, candidateName: parsed.data.full_name, jobTitle: job.title }),
      }),
      jobOwnerId
        ? notify({
            organizationId: job.organization_id,
            recipientId: jobOwnerId,
            type: "nueva_postulacion",
            title: "Nueva postulación",
            body: `${parsed.data.full_name} postuló a "${job.title}" desde el portal.`,
            url: `/postulaciones/${applicationResult.applicationId}`,
            entityType: "application",
            entityId: applicationResult.applicationId,
            email: {
              subject: "Nueva postulación",
              react: NuevaPostulacionEmail({
                platformName,
                candidateName: parsed.data.full_name,
                jobTitle: job.title,
                applicationUrl,
              }),
            },
          })
        : Promise.resolve(),
    ]);
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
