"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { createJob } from "@/lib/jobs/actions";
import { notifyError } from "@/lib/notifications/toast";
import { ActionButton } from "@/components/ui/action-button";
import { LabelSelect } from "@/components/ui/label-select";
import { EmploymentReasonSelect } from "@/components/vacantes/employment-reason-select";
import { CollaboratorsPicker } from "@/components/vacantes/collaborators-picker";
import { WORK_MODE_LABEL, VACANCY_TYPE_LABEL } from "@/lib/jobs/schema";
import type { EmploymentReasonOption } from "@/lib/employment-reasons/get-employment-reasons";
import type { TeamMemberOption } from "@/lib/jobs/get-team-options";

const FIELD_CLASS = "h-11 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-foreground";

export type TemplateSummary = {
  id: string;
  name: string;
  title: string;
  description: string;
  requirements: string;
  country: string;
  work_mode: string;
};

export function NuevaVacanteForm({
  templates,
  admins,
  members,
  employmentReasons,
  currentProfileId,
}: {
  templates: TemplateSummary[];
  admins: TeamMemberOption[];
  members: TeamMemberOption[];
  employmentReasons: EmploymentReasonOption[];
  currentProfileId: string;
}) {
  const [state, formAction] = useActionState(createJob, undefined);
  const [templateId, setTemplateId] = useState("");
  const selected = templates.find((t) => t.id === templateId);
  const defaultOwner = admins.some((a) => a.id === currentProfileId) ? currentProfileId : "";

  useEffect(() => {
    if (state?.error) notifyError(state.error);
  }, [state]);

  if (templates.length === 0) {
    return (
      <p className="rounded-md border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        Todavía no hay plantillas publicadas para elegir.{" "}
        <Link href="/configuracion/plantillas-vacante/nueva" className="font-medium text-accent underline">
          Crear una plantilla
        </Link>
        .
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Plantilla</span>
        <select
          name="template_id"
          required
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className={FIELD_CLASS}
        >
          <option value="" disabled>
            Elige una plantilla…
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div className="rounded-md border border-border bg-muted/30 p-4 text-sm">
          <p className="font-medium">{selected.title}</p>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{selected.description}</p>
          <p className="mt-3 text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Requisitos</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{selected.requirements}</p>
        </div>
      )}

      {/* key={templateId}: un input no controlado solo lee defaultValue al
          montar — sin remontar, cambiar de plantilla no actualizaría el
          país/modalidad prellenados de la anterior. */}
      <div key={templateId} className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">País</span>
          <input name="country" required defaultValue={selected?.country} className={FIELD_CLASS} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Modalidad</span>
          <LabelSelect name="work_mode" required labels={WORK_MODE_LABEL} defaultValue={selected?.work_mode} className={FIELD_CLASS} />
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Salario mín. (opcional)</span>
          <input name="salary_min" type="number" min={0} className={`${FIELD_CLASS} tabular-nums`} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Salario máx. (opcional)</span>
          <input name="salary_max" type="number" min={0} className={`${FIELD_CLASS} tabular-nums`} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Plazas</span>
          <input name="headcount" type="number" min={1} defaultValue={1} className={`${FIELD_CLASS} tabular-nums`} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Tipo de vacante</span>
          <LabelSelect name="vacancy_type" required labels={VACANCY_TYPE_LABEL} className={FIELD_CLASS} />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Motivo de la vacante</span>
          <EmploymentReasonSelect initialReasons={employmentReasons} />
        </label>
      </div>

      <div className="border-t border-border pt-5">
        <span className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">Equipo de reclutamiento</span>
        <div className="mt-3 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">Reclutador encargado</span>
            <select name="owner_id" required defaultValue={defaultOwner} className={FIELD_CLASS}>
              <option value="" disabled>
                Elige quién queda a cargo…
              </option>
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-xs text-muted-foreground">Colaboradores adicionales (opcional)</span>
            <CollaboratorsPicker members={members} />
          </label>
        </div>
      </div>

      <div className="border-t border-border pt-5">
        <ActionButton>Crear vacante</ActionButton>
      </div>
    </form>
  );
}
