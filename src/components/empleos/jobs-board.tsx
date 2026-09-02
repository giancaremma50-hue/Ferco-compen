"use client";

import { useMemo, useState } from "react";
import { JobPublicCard, type PublicJob } from "@/components/empleos/job-public-card";

export type FilterOption = { value: string; label: string };

/**
 * Filtrado 100% en cliente — la lista completa ya llegó del servidor (son
 * pocas vacantes, sin paginación) así que no tiene sentido ir y volver al
 * servidor en cada tecla del buscador. Cada select solo se renderiza si hay
 * 2+ valores distintos entre las vacantes abiertas (un filtro con una sola
 * opción real no ayuda a nadie).
 */
export function JobsBoard({
  jobs,
  countries,
  workModes,
  departments,
}: {
  jobs: (PublicJob & { department_id: string | null })[];
  countries: FilterOption[];
  workModes: FilterOption[];
  departments: FilterOption[];
}) {
  const [pais, setPais] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return jobs.filter((job) => {
      if (pais && job.country !== pais) return false;
      if (modalidad && job.work_mode !== modalidad) return false;
      if (departamento && job.department_id !== departamento) return false;
      if (query && !job.title.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [jobs, pais, modalidad, departamento, q]);

  const hasActiveFilter = Boolean(pais || modalidad || departamento || q);
  const selectClass =
    "h-9 rounded-md border border-border bg-card px-2.5 text-[13px] outline-none focus-visible:outline-ring focus-visible:outline-2";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border pb-4">
        {countries.length > 1 && (
          <select aria-label="País" value={pais} onChange={(e) => setPais(e.target.value)} className={selectClass}>
            <option value="">País</option>
            {countries.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        )}
        {workModes.length > 1 && (
          <select
            aria-label="Modalidad"
            value={modalidad}
            onChange={(e) => setModalidad(e.target.value)}
            className={selectClass}
          >
            <option value="">Modalidad</option>
            {workModes.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        )}
        {departments.length > 1 && (
          <select
            aria-label="Área"
            value={departamento}
            onChange={(e) => setDepartamento(e.target.value)}
            className={selectClass}
          >
            <option value="">Área</option>
            {departments.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        )}
        <input
          type="search"
          placeholder="Buscar por puesto"
          aria-label="Buscar por puesto"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 min-w-[160px] flex-1 rounded-md border border-border bg-card px-2.5 text-[13px] outline-none focus-visible:outline-ring focus-visible:outline-2"
        />
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => {
              setPais("");
              setModalidad("");
              setDepartamento("");
              setQ("");
            }}
            className="text-[12.5px] text-accent underline underline-offset-2"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      <div className="mt-2">
        {filtered.length === 0 ? (
          <p className="py-8 text-sm text-muted-foreground">Ninguna vacante coincide con esos filtros. Prueba quitando alguno.</p>
        ) : (
          filtered.map((job) => <JobPublicCard key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}
