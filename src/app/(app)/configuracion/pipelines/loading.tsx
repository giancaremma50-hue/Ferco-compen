import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="border border-border bg-card p-5">
      <Skeleton className="h-6 w-40" />
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
