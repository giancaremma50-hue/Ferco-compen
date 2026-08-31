import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/dal";

export default async function CandidatosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireProfile();
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("applications")
    .select("id, status, jobs(title), job_stages(name), candidates!inner(full_name, email)")
    .order("applied_at", { ascending: false })
    .limit(50);

  const term = q?.trim();
  if (term) {
    // ilike SÍ es correcto aquí (a diferencia del dedupe de Fase 4): es
    // búsqueda de texto libre para un humano, no una clave de igualdad. Se
    // quitan `,`, `(` y `)` porque tienen significado especial en la
    // sintaxis de filtros de PostgREST y este texto viene de la URL.
    const safeTerm = term.replace(/[,()]/g, "");
    query = query.or(`full_name.ilike.%${safeTerm}%,email.ilike.%${safeTerm}%`, {
      referencedTable: "candidates",
    });
  }

  const { data: applications } = await query;

  return (
    <div>
      <h1 className="font-serif text-[32px]">Candidatos</h1>
      <form className="mt-6">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre o correo"
          className="h-10 w-72 rounded-md border border-border bg-background px-3 text-sm"
        />
      </form>

      {!applications || applications.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">No se encontraron candidatos.</p>
      ) : (
        <div className="mt-6 grid gap-2">
          {applications.map((a) => (
            <Link
              key={a.id}
              href={`/postulaciones/${a.id}`}
              className="flex items-center justify-between border border-border bg-card px-4 py-3 text-sm hover:border-foreground/30"
            >
              <span>{a.candidates.full_name}</span>
              <span className="text-muted-foreground">
                {a.jobs?.title} · {a.job_stages?.name}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
