import { Skeleton } from "@/components/ui/skeleton";

export default function ErroresLoading() {
  return (
    <div>
      <Skeleton className="h-6 w-72" />
      <Skeleton className="mt-2.5 h-6 w-72" />
      <div className="mt-6 grid gap-px">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
