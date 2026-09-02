import Link from "next/link";
import { WORK_MODE_LABEL } from "@/lib/jobs/schema";
import type { WorkMode } from "@/lib/jobs/schema";

export type PublicJob = {
  id: string;
  slug: string | null;
  title: string;
  country: string | null;
  location: string | null;
  work_mode: string | null;
  department_name: string | null;
};

/**
 * Fila, no tarjeta — con la columna de departamento nueva, una tarjeta con
 * borde completo por posición pesa más de lo que aporta en una lista larga.
 * El acento solo aparece como línea de 2px a la izquierda al pasar el mouse,
 * nunca como relleno.
 */
export function JobPublicCard({ job }: { job: PublicJob }) {
  return (
    <Link
      href={`/empleos/${job.slug}`}
      className="group relative flex items-center justify-between gap-4 border-b border-border py-4 pl-3 pr-1 transition-colors hover:bg-muted/40"
    >
      <span className="absolute inset-y-0 left-0 w-0.5 bg-transparent group-hover:bg-accent" aria-hidden />
      <div className="min-w-0">
        <p className="font-serif truncate text-lg group-hover:text-accent">{job.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <span>{[job.location, job.country].filter(Boolean).join(", ") || "Ubicación no especificada"}</span>
          {job.department_name && <span className="before:mr-1.5 before:content-['·']">{job.department_name}</span>}
        </p>
      </div>
      {job.work_mode && (
        <span className="shrink-0 rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground">
          {WORK_MODE_LABEL[job.work_mode as WorkMode] ?? job.work_mode}
        </span>
      )}
    </Link>
  );
}
