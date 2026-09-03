"use client";

import { useRef } from "react";
import Link from "next/link";
import { Info, X } from "lucide-react";
import type { JobDetail } from "@/lib/jobs/get-jobs";
import type { JobCollaboratorRow } from "@/lib/jobs/get-collaborators";
import { JobStatusBadge } from "./job-status-badge";
import { WORK_MODE_LABEL, EMPLOYMENT_TYPE_LABEL } from "@/lib/jobs/schema";
import type { WorkMode, EmploymentType } from "@/lib/jobs/schema";
import { PERMISSION_LABEL } from "@/lib/jobs/collaborators-schema";

/**
 * Resumen de la vacante, accesible desde el pipeline — el detalle completo
 * (competencias, aprobar/editar, bitácora, administrar colaboradores) se
 * quedó en /vacantes/[id], un clic más lejos ("Ver detalle completo"), no
 * duplicado acá: nada se perdió, solo dejó de ser la pantalla principal. El
 * equipo de reclutamiento (encargado + colaboradores) sí se muestra acá,
 * de solo lectura, porque es lo primero que se pregunta al abrir el
 * pipeline — no vale la pena un clic más para verlo.
 */
export function JobInfoModal({ job, collaborators }: { job: JobDetail; collaborators: JobCollaboratorRow[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground hover:border-accent hover:text-accent"
      >
        <Info className="size-3.5" aria-hidden />
        Info de la vacante
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="w-full max-w-[560px] rounded-lg border border-border bg-card p-0 text-foreground backdrop:bg-foreground/25"
      >
        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs tabular-nums text-muted-foreground">{job.code}</p>
              <h2 className="font-serif mt-1 text-2xl">{job.title}</h2>
            </div>
            <div className="flex flex-none items-center gap-2">
              <JobStatusBadge status={job.status} />
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => dialogRef.current?.close()}
                className="flex size-[30px] items-center justify-center rounded-md border border-border"
              >
                <X className="size-3.5 text-muted-foreground" aria-hidden />
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-border py-5 text-sm">
            <Item label="País" value={job.country ?? "—"} />
            <Item label="Ubicación" value={job.location ?? "—"} />
            <Item label="Modalidad" value={job.work_mode ? WORK_MODE_LABEL[job.work_mode as WorkMode] : "—"} />
            <Item
              label="Tipo de contrato"
              value={job.employment_type ? EMPLOYMENT_TYPE_LABEL[job.employment_type as EmploymentType] : "—"}
            />
            <Item label="Plazas" value={String(job.headcount)} />
            <Item
              label="Rango salarial"
              value={job.salary_min || job.salary_max ? `${job.salary_min ?? "?"} – ${job.salary_max ?? "?"}` : "No especificado"}
            />
          </div>

          <div className="mt-5">
            <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Descripción</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{job.description}</p>
          </div>

          <div className="mt-5">
            <p className="text-[11px] tracking-[0.13em] text-muted-foreground uppercase">Equipo de reclutamiento</p>
            <div className="mt-2 flex items-center justify-between gap-3 border-b border-border py-2 text-sm">
              <span>{job.ownerName ?? "Sin encargado asignado"}</span>
              <span className="text-xs text-muted-foreground">Encargado</span>
            </div>
            {collaborators.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">Sin colaboradores agregados todavía.</p>
            ) : (
              collaborators.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 border-b border-border py-2 text-sm">
                  <span>{c.profile?.display_name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{PERMISSION_LABEL[c.permission]}</span>
                </div>
              ))
            )}
          </div>

          <div className="mt-5">
            <Link href={`/vacantes/${job.id}`} className="text-sm font-medium text-accent underline">
              Ver detalle completo (colaboradores, competencias, bitácora) →
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-[0.06em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 tabular-nums">{value}</p>
    </div>
  );
}
