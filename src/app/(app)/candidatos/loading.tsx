import { Skeleton } from "@/components/ui/skeleton";

export default function CandidatosLoading() {
  return (
    <div>
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-6 h-10 w-72" />
      <div className="mt-6 grid gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[52px] w-full" />
        ))}
      </div>
    </div>
  );
}
