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
};

export function JobPublicCard({ job }: { job: PublicJob }) {
  return (
    <Link
      href={`/empleos/${job.slug}`}
      className="flex items-center justify-between gap-4 border border-border bg-card px-5 py-4 transition-colors hover:border-foreground/30"
    >
      <div className="min-w-0">
        <p className="font-serif truncate text-lg">{job.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {[job.location, job.country].filter(Boolean).join(", ") || "Ubicación no especificada"}
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
