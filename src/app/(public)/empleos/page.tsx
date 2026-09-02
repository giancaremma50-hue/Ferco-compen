import { createClient } from "@/lib/supabase/server";
import { getOrganization } from "@/lib/organizations/get-organization";
import { JobsBoard, type FilterOption } from "@/components/empleos/jobs-board";
import { HeroBackgroundMedia } from "@/components/layout/hero-background-media";
import { WORK_MODE_LABEL } from "@/lib/jobs/schema";
import type { WorkMode } from "@/lib/jobs/schema";

type JobRow = {
  id: string;
  slug: string | null;
  title: string;
  country: string | null;
  location: string | null;
  work_mode: string | null;
  department_id: string | null;
  departments: { name: string } | null;
};

function distinctOptions(values: (string | null)[], labelFor: (v: string) => string): FilterOption[] {
  const unique = [...new Set(values.filter((v): v is string => Boolean(v)))];
  return unique.map((value) => ({ value, label: labelFor(value) })).sort((a, b) => a.label.localeCompare(b.label));
}

export default async function EmpleosPage() {
  const supabase = await createClient();
  const [{ data: jobsData }, organization] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, slug, title, country, location, work_mode, department_id, departments(name)")
      .eq("status", "abierta")
      .eq("is_public", true)
      .order("published_at", { ascending: false }),
    getOrganization(),
  ]);

  const allJobs = (jobsData ?? []) as JobRow[];

  const countryOptions = distinctOptions(
    allJobs.map((j) => j.country),
    (v) => v,
  );
  const workModeOptions = distinctOptions(
    allJobs.map((j) => j.work_mode),
    (v) => WORK_MODE_LABEL[v as WorkMode] ?? v,
  );
  // dedupe por id, no por nombre — dos departamentos distintos podrían compartir nombre.
  const departmentMap = new Map<string, string>();
  for (const j of allJobs) {
    if (j.department_id && j.departments?.name) departmentMap.set(j.department_id, j.departments.name);
  }
  const departmentOptions: FilterOption[] = [...departmentMap.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const hasCover = Boolean(organization?.careers_cover_image_url || organization?.careers_cover_video_url);
  const headline = organization?.careers_headline || "Vacantes abiertas";

  const stats: { n: number; label: string }[] = [];
  if (allJobs.length > 0) stats.push({ n: allJobs.length, label: allJobs.length === 1 ? "vacante abierta" : "vacantes abiertas" });
  if (countryOptions.length > 1) stats.push({ n: countryOptions.length, label: "países" });
  if (departmentOptions.length > 1) stats.push({ n: departmentOptions.length, label: "áreas contratando" });

  return (
    <div>
      {hasCover ? (
        <section
          className="relative flex min-h-[72vh] flex-col overflow-hidden text-background"
          style={{ backgroundColor: organization?.accent_color || "#1f4d3d" }}
        >
          {/* Fondo sólido del acento, siempre debajo — si solo hay video y el
              visitante pidió prefers-reduced-motion (sin imagen de respaldo),
              HeroBackgroundMedia no renderiza nada; sin este color de base el
              héroe quedaría vacío en vez de caer a un panel de marca sólido,
              mismo patrón que ya usa /login. */}
          <div className="absolute inset-0">
            <HeroBackgroundMedia
              videoUrl={organization?.careers_cover_video_url ?? null}
              imageUrl={organization?.careers_cover_image_url ?? null}
              priority
            />
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(180deg, rgba(10,12,9,.15) 0%, rgba(10,12,9,.55) 62%, rgba(10,12,9,.88) 100%)" }}
            />
          </div>
          <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col justify-end px-6 pb-14">
            <h1 className="font-serif max-w-[16ch] text-[clamp(34px,5vw,56px)] leading-[1.08]">{headline}</h1>
            {organization?.careers_intro && (
              <p className="mt-4 max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed text-background/85">
                {organization.careers_intro}
              </p>
            )}
            {allJobs.length > 0 ? (
              <a
                href="#vacantes"
                className="mt-7 inline-flex w-fit items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-medium text-accent-foreground"
              >
                Ver vacantes abiertas
              </a>
            ) : null}
            {stats.length > 0 && (
              <div className="mt-8 flex border-t border-background/25">
                {stats.map((s) => (
                  <div key={s.label} className="flex-1 border-r border-background/25 pt-4 pr-5 last:border-r-0" data-numeric>
                    <span className="font-serif block text-[26px] leading-none">{s.n}</span>
                    <span className="mt-1.5 block text-[11.5px] text-background/70">{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="mx-auto max-w-4xl px-6 pt-16">
          <h1 className="font-serif text-[40px]">{headline}</h1>
          {organization?.careers_intro && (
            <p className="mt-4 max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed text-muted-foreground">
              {organization.careers_intro}
            </p>
          )}
          {stats.length > 0 && (
            <div className="mt-8 flex border border-border">
              {stats.map((s) => (
                <div key={s.label} className="flex-1 border-r border-border p-4 last:border-r-0" data-numeric>
                  <span className="font-serif block text-2xl leading-none">{s.n}</span>
                  <span className="mt-1.5 block text-[11.5px] text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div id="vacantes" className="mx-auto max-w-4xl scroll-mt-6 px-6 py-14">
        {allJobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay vacantes abiertas por ahora. Vuelve a revisar pronto.</p>
        ) : (
          <JobsBoard
            jobs={allJobs.map((job) => ({
              id: job.id,
              slug: job.slug,
              title: job.title,
              country: job.country,
              location: job.location,
              work_mode: job.work_mode,
              department_id: job.department_id,
              department_name: job.departments?.name ?? null,
            }))}
            countries={countryOptions}
            workModes={workModeOptions}
            departments={departmentOptions}
          />
        )}
      </div>
    </div>
  );
}
