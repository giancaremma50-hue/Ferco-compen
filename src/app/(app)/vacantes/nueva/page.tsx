import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/dal";
import { getPublishedJobTemplates } from "@/lib/job-templates/get-job-templates";
import { getOrgAdmins, getOrgMembers } from "@/lib/jobs/get-team-options";
import { getEmploymentReasons } from "@/lib/employment-reasons/get-employment-reasons";
import { NuevaVacanteForm } from "@/components/vacantes/nueva-vacante-form";
import { HelpTourButton } from "@/components/ui/help-tour-button";

const HELP_STEPS = [
  { selector: '[data-tour="nv-plantilla"]', title: "Plantilla de puesto", description: "Elegí el puesto recurrente del que sale esta vacante — solo aparecen las plantillas publicadas (no las que están en borrador), y las confidenciales solo si vos las creaste (o sos super_admin)." },
  { selector: '[data-tour="nv-preview"]', title: "Lo que trae la plantilla", description: "Título, descripción y requisitos vienen tal cual de la plantilla, de solo lectura acá — si necesitás cambiarlos, se edita en la plantilla, no en esta vacante puntual." },
  { selector: '[data-tour="nv-salario"]', title: "Salario y plazas", description: "El salario es opcional y siempre interno — nunca se muestra en el portal público. \"Plazas\" es cuántos puestos idénticos abre esta misma vacante." },
  { selector: '[data-tour="nv-tipo"]', title: "Tipo y motivo de la vacante", description: "Nueva posición, reemplazo o crecimiento — el motivo es un catálogo de tu organización, y podés agregar uno nuevo ahí mismo si no está en la lista." },
  { selector: '[data-tour="nv-equipo"]', title: "Equipo de reclutamiento", description: "El reclutador encargado queda como dueño de la vacante (recibe las notificaciones). Los colaboradores adicionales entran solo como \"viewer\" (ven, no operan) — su nivel de acceso se puede subir después desde el panel de colaboradores de la vacante." },
];

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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[32px]">Solicitar vacante</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Se crea en borrador — puedes ajustarla antes de enviarla a aprobación.
          </p>
        </div>
        <HelpTourButton
          intro={{ title: "Crear una vacante", description: "Una vacante siempre nace de una plantilla de puesto ya publicada — lo específico de esta ocasión (salario, plazas, quién la lleva) se define acá." }}
          steps={HELP_STEPS}
        />
      </div>
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
