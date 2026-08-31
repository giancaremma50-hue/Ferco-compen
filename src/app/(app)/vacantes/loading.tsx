import { Skeleton } from "@/components/ui/skeleton";

export default function VacantesLoading() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="mt-8 grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-full" />
        ))}
      </div>
    </div>
  );
}
