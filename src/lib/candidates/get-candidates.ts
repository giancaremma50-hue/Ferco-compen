import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import type { z } from "zod";
import type { CandidateFiltersSchema } from "./schema";

export type CandidateFilters = z.infer<typeof CandidateFiltersSchema>;

export type CandidateRow = {
  id: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string | null;
  stageName: string | null;
  status: Database["public"]["Enums"]["application_status"];
  rating: number | null;
  appliedAt: string;
};

const PAGE_LIMIT = 100;

export type CandidateRowsResult = { rows: CandidateRow[]; capped: boolean };

/**
 * RLS ya decide qué postulaciones ve este viewer — este archivo solo arma
 * filtros y columnas. `job_stages` se trae SIN `!inner`: un colaborador
 * sigue viendo la postulación de un referido aunque la vacante ya no le
 * sea visible (RLS de `job_stages`/`jobs` es más estricta que la de
 * `applications`), y forzar el inner join aquí borraría esa fila entera en
 * silencio en vez de solo mostrar la etapa como desconocida — mismo bug ya
 * corregido en Fase 5 con `jobs(title)`.
 */
export async function getCandidateRows(filters: CandidateFilters): Promise<CandidateRowsResult> {
  const supabase = await createClient();
  let query = supabase
    .from("applications")
    .select("id, status, rating, applied_at, jobs(title), job_stages(name, type), candidates!inner(full_name, email)")
    .order("applied_at", { ascending: false })
    .limit(PAGE_LIMIT);

  if (filters.job_id) query = query.eq("job_id", filters.job_id);
  if (filters.status) query = query.eq("status", filters.status);

  const term = filters.q?.trim();
  if (term) {
    // Mismo saneo que la búsqueda anterior de esta página: neutraliza
    // sintaxis de filtros de PostgREST (`,()`), comodines de ILIKE
    // (`%_\`) y el alias `*` que PostgREST sustituye por `%` antes de que
    // Postgres vea el patrón.
    const safeTerm = term.replace(/[,()*]/g, "").replace(/[%_\\]/g, (c) => `\\${c}`);
    query = query.or(`full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%`, { referencedTable: "candidates" });
  }

  const { data } = await query;
  const rows = data ?? [];

  // El tipo de etapa vive en job_stages, que aquí NO es inner-join (ver
  // comentario arriba) — filtrar en JS en vez de con `.eq()` sobre el
  // embed, para no reintroducir el mismo problema de RLS.
  const filtered = filters.stage_type ? rows.filter((a) => a.job_stages?.type === filters.stage_type) : rows;

  return {
    rows: filtered.map((a) => ({
      id: a.id,
      candidateName: a.candidates!.full_name,
      candidateEmail: a.candidates!.email,
      jobTitle: a.jobs?.title ?? null,
      stageName: a.job_stages?.name ?? null,
      status: a.status,
      rating: a.rating,
      appliedAt: a.applied_at,
    })),
    // Solo advierte del límite cuando NO se filtró por etapa en memoria —
    // con ese filtro el conteo real después de `.limit()` ya no refleja
    // cuántas filas hay en total antes de recortar.
    capped: !filters.stage_type && rows.length === PAGE_LIMIT,
  };
}
