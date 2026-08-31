import { createClient } from "@/lib/supabase/server";
import { JobPublicCard } from "@/components/empleos/job-public-card";

export default async function EmpleosPage() {
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("jobs")
    .select("id, slug, title, country, location, work_mode")
    .eq("status", "abierta")
    .eq("is_public", true)
    .order("published_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-serif text-[40px]">Vacantes abiertas</h1>
      {!jobs || jobs.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          No hay vacantes abiertas por ahora. Vuelve a revisar pronto.
        </p>
      ) : (
        <div className="mt-10 grid gap-3">
          {jobs.map((job) => (
            <JobPublicCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
