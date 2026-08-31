import Link from "next/link";
import type { JobListItem } from "@/lib/jobs/get-jobs";
import { JobStatusBadge } from "./job-status-badge";

export function JobCard({ job }: { job: JobListItem }) {
  return (
    <Link
      href={`/vacantes/${job.id}`}
      className="flex items-center justify-between gap-4 border border-border bg-card px-5 py-4 transition-colors hover:border-foreground/30"
    >
      <div className="min-w-0">
        <p className="font-serif truncate text-lg">{job.title}</p>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {job.code} · {job.country ?? "Sin país"} · {job.headcount} {job.headcount === 1 ? "plaza" : "plazas"}
        </p>
      </div>
      <JobStatusBadge status={job.status} />
    </Link>
  );
}
