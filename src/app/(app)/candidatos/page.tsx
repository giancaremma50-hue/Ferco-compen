import Link from "next/link";
import { requireProfile } from "@/lib/auth/dal";
import { getCandidateRows, type CandidateFilters } from "@/lib/candidates/get-candidates";
import { getSegments } from "@/lib/candidates/get-segments";
import { getJobTitlesForViewer } from "@/lib/jobs/get-jobs";
import { SaveSegmentButton } from "@/components/candidatos/save-segment-button";
import { SegmentList } from "@/components/candidatos/segment-list";
import { STAGE_TYPE_LABEL, STATUS_LABEL } from "@/lib/candidates/labels";
import { CandidateFiltersSchema } from "@/lib/candidates/schema";

export default async function CandidatosPage({
  searchParams,
}: {
  searchParams: Promise<{ job_id?: string; stage_type?: string; status?: string; q?: string }>;
}) {
  const profile = await requireProfile();
  const params = await searchParams;

  // Un valor de la URL que no coincide con el schema (enum viejo, id con
  // formato inválido) simplemente se descarta — mismo schema que valida
  // el formulario para guardar un segmento, una sola fuente de verdad.
  const parsedFilters = CandidateFiltersSchema.safeParse(params);
  const filters: CandidateFilters = parsedFilters.success ? parsedFilters.data : {};

  const [{ rows: candidates, capped }, segments, jobs] = await Promise.all([
    getCandidateRows(filters),
    getSegments(profile.organization_id).catch(() => []),
    getJobTitlesForViewer().catch(() => []),
  ]);

  return (
    <div>
      <h1 className="font-serif text-[32px]">Candidatos</h1>

      <form className="mt-6 flex flex-wrap items-end gap-2.5">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Buscar</span>
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Nombre o correo"
            className="h-9 w-56 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Vacante</span>
          <select name="job_id" defaultValue={filters.job_id ?? ""} className="h-9 w-44 rounded-md border border-border bg-background px-2 text-xs">
            <option value="">Todas</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Etapa</span>
          <select name="stage_type" defaultValue={filters.stage_type ?? ""} className="h-9 w-36 rounded-md border border-border bg-background px-2 text-xs">
            <option value="">Todas</option>
            {Object.entries(STAGE_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Estado</span>
          <select name="status" defaultValue={filters.status ?? ""} className="h-9 w-32 rounded-md border border-border bg-background px-2 text-xs">
            <option value="">Todos</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-9 rounded-md border border-border bg-card px-4 text-xs font-medium">
          Filtrar
        </button>
        {(filters.job_id || filters.stage_type || filters.status || filters.q) && (
          <Link href="/candidatos" className="h-9 px-1 text-xs text-muted-foreground underline leading-9">
            Limpiar
          </Link>
        )}
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SegmentList segments={segments} />
        <SaveSegmentButton filters={filters} />
      </div>

      {candidates.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">No se encontraron candidatos.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-[0.08em] text-muted-foreground uppercase">
                <th className="py-2 pr-4 font-normal">Candidato</th>
                <th className="py-2 pr-4 font-normal">Vacante</th>
                <th className="py-2 pr-4 font-normal">Etapa</th>
                <th className="py-2 pr-4 font-normal">Estado</th>
                <th className="py-2 pr-4 font-normal">Calificación</th>
                <th className="py-2 pr-0 font-normal">Postuló</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b border-border/60">
                  <td className="py-2.5 pr-4">
                    <Link href={`/postulaciones/${c.id}`} className="font-medium hover:underline">
                      {c.candidateName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{c.candidateEmail}</p>
                  </td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{c.jobTitle ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{c.stageName ?? "—"}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{STATUS_LABEL[c.status]}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">{c.rating ?? "—"}</td>
                  <td className="py-2.5 pr-0 tabular-nums text-muted-foreground">
                    {new Date(c.appliedAt).toLocaleDateString("es", { dateStyle: "medium" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {capped && (
            <p className="mt-3 text-xs text-muted-foreground">
              Mostrando los {candidates.length} más recientes — afina la búsqueda o los filtros para ver el resto.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
