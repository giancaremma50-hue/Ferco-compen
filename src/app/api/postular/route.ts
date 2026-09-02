import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  findOrCreateCandidate,
  createApplicationForCandidate,
  rollbackIfNewCandidate,
} from "@/lib/jobs/create-application";
import { buildApplySchema } from "@/lib/jobs/build-apply-schema";
import { computePrequalified } from "@/lib/jobs/compute-prequalified";
import { notify, notifyBestEffort, getEmailContext } from "@/lib/notifications/notify";
import { zodFieldError } from "@/lib/forms/zod-error";
import { sendEmail } from "@/lib/email/send-email";
import { NuevaPostulacionEmail } from "@/emails/nueva-postulacion";
import { PostulacionRecibidaEmail } from "@/emails/postulacion-recibida";
import { parseCandidacyFields } from "@/lib/job-templates/candidacy-fields";

const MAX_CV_BYTES = 10 * 1024 * 1024;
const ALLOWED_CV_TYPE = "application/pdf";
const MAX_ADDITIONAL_FILES = 5;
const ALLOWED_ADDITIONAL_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);

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

  // job_id se valida solo (sin el resto del schema) porque candidacy_fields
  // — lo que decide el RESTO del schema — vive en la fila que ese id
  // señala. No hay forma de armar el schema completo sin leer la vacante
  // primero.
  const jobIdResult = z.uuid({ error: "Vacante inválida." }).safeParse(formData.get("job_id"));
  if (!jobIdResult.success) {
    return NextResponse.json({ error: "Vacante inválida." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: job } = await admin
    .from("jobs")
    .select("id, organization_id, status, is_public, title, owner_id, requested_by, candidacy_fields")
    .eq("id", jobIdResult.data)
    .single();

  if (!job || job.status !== "abierta" || !job.is_public) {
    return NextResponse.json({ error: "Esta vacante ya no está disponible." }, { status: 404 });
  }

  const candidacyFields = parseCandidacyFields(job.candidacy_fields);
  const applySchema = buildApplySchema(candidacyFields);
  const parsed = applySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return NextResponse.json(zodFieldError(parsed.error), { status: 400 });
  }

  const cv = formData.get("cv");
  const resumeRequired = candidacyFields.resume === "required";
  const resumeOffered = candidacyFields.resume !== "hidden";
  if (resumeOffered && resumeRequired && (!(cv instanceof File) || cv.size === 0)) {
    return NextResponse.json({ error: "Adjunta tu CV en PDF.", field: "cv" }, { status: 400 });
  }
  const hasCv = resumeOffered && cv instanceof File && cv.size > 0;
  if (hasCv) {
    const cvFile = cv as File;
    if (cvFile.size > MAX_CV_BYTES) {
      return NextResponse.json(
        { error: "El CV pesa más de 10 MB. Comprímelo e inténtalo de nuevo.", field: "cv" },
        { status: 400 },
      );
    }
    if (cvFile.type !== ALLOWED_CV_TYPE) {
      return NextResponse.json({ error: "El CV debe ser un archivo PDF.", field: "cv" }, { status: 400 });
    }
  }

  const additionalOffered = candidacyFields.additional_files !== "hidden";
  const additionalFiles = additionalOffered
    ? formData.getAll("additional_files").filter((f): f is File => f instanceof File && f.size > 0)
    : [];
  if (additionalFiles.length > MAX_ADDITIONAL_FILES) {
    return NextResponse.json({ error: `Máximo ${MAX_ADDITIONAL_FILES} archivos adicionales.` }, { status: 400 });
  }
  for (const file of additionalFiles) {
    if (file.size > MAX_CV_BYTES) {
      return NextResponse.json({ error: "Cada archivo adicional pesa como máximo 10 MB." }, { status: 400 });
    }
    if (!ALLOWED_ADDITIONAL_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Los archivos adicionales deben ser PDF, JPG o PNG." }, { status: 400 });
    }
  }
  if (
    additionalOffered &&
    candidacyFields.additional_files === "required" &&
    additionalFiles.length === 0
  ) {
    return NextResponse.json({ error: "Adjunta al menos un archivo adicional." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const { data: existingCandidate } = await admin
    .from("candidates")
    .select("id")
    .eq("organization_id", job.organization_id)
    .eq("email", email)
    .maybeSingle();

  // Chequeo temprano: evita subir archivos que de todos modos se van a
  // rechazar por postulación duplicada.
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

  // El candidato se resuelve/crea ANTES de subir cualquier archivo:
  // cvs_privado_select (política de Storage) exige que el segundo segmento
  // de la ruta sea el candidate_id — subir primero y crear el candidato
  // después dejaría el archivo en una ruta que ninguna política de lectura
  // puede evaluar.
  const candidateResult = await findOrCreateCandidate(
    job.organization_id,
    {
      // "full_name" puede estar oculto en la candidatura de esta vacante —
      // sin nombre real, se usa el prefijo del correo como último recurso,
      // nunca se deja vacío (candidates.full_name no acepta null).
      full_name: parsed.data.full_name ?? email.split("@")[0],
      email,
      phone: parsed.data.phone ?? null,
      address: parsed.data.address ?? null,
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

  let cvPath: string | null = null;
  if (hasCv) {
    const cvFile = cv as File;
    cvPath = `${job.organization_id}/${candidateId}/${Date.now()}.pdf`;
    const { error: uploadError } = await admin.storage.from("cvs-privado").upload(cvPath, cvFile, {
      contentType: ALLOWED_CV_TYPE,
    });
    if (uploadError) {
      await rollbackIfNewCandidate(candidateId, isNewCandidate);
      return NextResponse.json({ error: "No se pudo subir tu CV. Inténtalo de nuevo." }, { status: 500 });
    }
  }

  const additionalUploads: { path: string; file: File }[] = [];
  for (const [index, file] of additionalFiles.entries()) {
    const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
    const path = `${job.organization_id}/${candidateId}/${Date.now()}-adicional-${index}.${extension}`;
    const { error: uploadError } = await admin.storage.from("cvs-privado").upload(path, file, { contentType: file.type });
    if (uploadError) {
      // Los que ya subieron quedan huérfanos en Storage — mismo trade-off
      // aceptado que el resto de este endpoint (mejor un archivo suelto sin
      // referenciar que bloquear la postulación entera por un fallo parcial
      // de red a mitad de una subida de varios).
      console.error("postular: no se pudo subir un archivo adicional", uploadError);
      continue;
    }
    additionalUploads.push({ path, file });
  }

  // Preguntas de la vacante — se responden todas opcionalmente (ninguna es
  // obligatoria), así que solo se guarda lo que de verdad llegó marcado o
  // escrito. `answer_<questionId>` es el nombre de campo que usa el
  // formulario dinámico (ver ApplicationForm).
  const { data: jobQuestions } = await admin
    .from("job_questions")
    .select("id, type, job_question_options(id, is_expected)")
    .eq("job_id", job.id);

  const answers = (jobQuestions ?? [])
    .map((q) => {
      const raw = formData.get(`answer_${q.id}`);
      if (typeof raw !== "string" || raw.trim() === "") return null;
      if (q.type === "open") {
        return { job_question_id: q.id, answer_text: raw.trim(), selected_option_id: null };
      }
      const validOptionIds = new Set((q.job_question_options ?? []).map((o) => o.id));
      if (!validOptionIds.has(raw)) return null;
      return { job_question_id: q.id, answer_text: null, selected_option_id: raw };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const multipleChoiceQuestions = (jobQuestions ?? [])
    .filter((q) => q.type === "multiple_choice")
    .map((q) => ({ id: q.id, options: q.job_question_options ?? [] }));
  const prequalified = computePrequalified(
    multipleChoiceQuestions,
    answers.map((a) => ({ job_question_id: a.job_question_id, selected_option_id: a.selected_option_id })),
  );

  const applicationResult = await createApplicationForCandidate(
    admin,
    job.organization_id,
    job.id,
    candidateId,
    isNewCandidate,
    { cover_letter: parsed.data.cover_letter ?? null, prequalified },
  );

  if ("error" in applicationResult) {
    if (cvPath) await admin.storage.from("cvs-privado").remove([cvPath]);
    if (additionalUploads.length > 0) await admin.storage.from("cvs-privado").remove(additionalUploads.map((u) => u.path));
    return NextResponse.json(
      { error: applicationResult.error },
      { status: applicationResult.duplicate ? 409 : 500 },
    );
  }

  // El CV nuevo pasa a ser el vigente en el perfil; si ya tenía uno de una
  // postulación anterior, queda igual en attachments (no se borra). Best
  // effort: si esto falla, la postulación y los adjuntos de abajo ya
  // quedaron bien registrados.
  if (cvPath) {
    await admin.from("candidates").update({ cv_file_path: cvPath }).eq("id", candidateId);
  }

  // Best-effort: la postulación en sí ya quedó registrada (lo que le importa
  // al candidato), así que un fallo acá no debe convertir un éxito real en
  // un error de cara al usuario.
  await Promise.all([
    cvPath
      ? admin.from("attachments").insert({
          organization_id: job.organization_id,
          candidate_id: candidateId,
          application_id: applicationResult.applicationId,
          file_path: cvPath,
          file_name: (cv as File).name || "cv.pdf",
          file_size_bytes: (cv as File).size,
          kind: "cv",
        })
      : Promise.resolve(),
    additionalUploads.length > 0
      ? admin.from("attachments").insert(
          additionalUploads.map(({ path, file }) => ({
            organization_id: job.organization_id,
            candidate_id: candidateId,
            application_id: applicationResult.applicationId,
            file_path: path,
            file_name: file.name || "archivo",
            file_size_bytes: file.size,
            kind: "adicional",
          })),
        )
      : Promise.resolve(),
    answers.length > 0
      ? admin.from("application_answers").insert(
          answers.map((a) => ({
            organization_id: job.organization_id,
            job_id: job.id,
            application_id: applicationResult.applicationId,
            job_question_id: a.job_question_id,
            answer_text: a.answer_text,
            selected_option_id: a.selected_option_id,
          })),
        )
      : Promise.resolve(),
    admin.from("application_events").insert({
      organization_id: job.organization_id,
      application_id: applicationResult.applicationId,
      type: "postulacion_creada",
      payload: { origen: "portal" },
    }),
  ]);

  // Best-effort, corre con after() DESPUÉS de responder: la postulación ya
  // quedó completa arriba, así que ninguna de las dos debe demorar ni
  // arriesgar la respuesta 201. La del candidato es un correo directo con
  // sendEmail(), no notify() — el candidato no tiene perfil ni fila en
  // `notifications`, esa tabla es solo para usuarios internos.
  const jobOwnerId = job.owner_id ?? job.requested_by;
  const applicantName = parsed.data.full_name ?? email.split("@")[0];
  notifyBestEffort(async () => {
    const { platformName, siteUrl } = await getEmailContext();
    const applicationUrl = `${siteUrl}/postulaciones/${applicationResult.applicationId}`;
    await Promise.all([
      sendEmail({
        to: email,
        subject: "Recibimos tu postulación",
        react: PostulacionRecibidaEmail({ platformName, candidateName: applicantName, jobTitle: job.title }),
      }),
      jobOwnerId
        ? notify({
            organizationId: job.organization_id,
            recipientId: jobOwnerId,
            type: "nueva_postulacion",
            title: "Nueva postulación",
            body: `${applicantName} postuló a "${job.title}" desde el portal.`,
            url: `/postulaciones/${applicationResult.applicationId}`,
            entityType: "application",
            entityId: applicationResult.applicationId,
            email: {
              subject: "Nueva postulación",
              react: NuevaPostulacionEmail({
                platformName,
                candidateName: applicantName,
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
