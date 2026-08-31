import { Skeleton } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <div>
      <Skeleton className="h-9 w-72" />
      <Skeleton className="mt-2 h-4 w-48" />
      <div className="mt-8 flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-96 w-64 shrink-0" />
        ))}
      </div>
    </div>
  );
}
