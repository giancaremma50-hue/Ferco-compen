import { Skeleton } from "@/components/ui/skeleton";

export default function MisReportesLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-2 h-5 w-72" />
      <div className="mt-8 grid gap-px">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
