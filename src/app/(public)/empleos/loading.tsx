import { Skeleton } from "@/components/ui/skeleton";

export default function EmpleosLoading() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <Skeleton className="h-11 w-72" />
      <div className="mt-10 grid gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-full" />
        ))}
      </div>
    </div>
  );
}
