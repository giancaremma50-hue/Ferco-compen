import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getPublishedJobTemplates } from "@/lib/job-templates/get-job-templates";
import { getOrgAdmins, getOrgMembers } from "@/lib/jobs/get-team-options";
import { getEmploymentReasons } from "@/lib/employment-reasons/get-employment-reasons";
import { NuevaVacanteForm } from "@/components/vacantes/nueva-vacante-form";

export default async function NuevaVacantePage() {
  const profile = await requireProfile();
  if (profile.role === "colaborador") redirect("/vacantes");

  const [jobTemplates, admins, members, employmentReasons] = await Promise.all([
    getPublishedJobTemplates(profile.organization_id).catch(() => []),
    getOrgAdmins(profile.organization_id),
    getOrgMembers(profile.organization_id),
    getEmploymentReasons(profile.organization_id),
  ]);

  // Solo lo que el formulario necesita mostrar como vista previa —
  // description/requirements resumen la plantilla, nada de candidatura,
  // preguntas ni etapas viaja al cliente (createJob las vuelve a leer
  // server-side a partir del template_id, ver el comentario ahí).
  const templates = jobTemplates.map((t) => ({
    id: t.id,
    name: t.name,
    title: t.title,
    description: t.description,
    requirements: t.requirements,
    country: t.country,
    work_mode: t.work_mode,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-serif text-[32px]">Solicitar vacante</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Se crea en borrador — puedes ajustarla antes de enviarla a aprobación.
      </p>
      <NuevaVacanteForm
        templates={templates}
        admins={admins}
        members={members}
        employmentReasons={employmentReasons}
        currentProfileId={profile.id}
      />
    </div>
  );
}
