import { Skeleton } from "@/components/ui/skeleton";

export default function VacanteDetailLoading() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2.5 h-10 w-2/3" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>
      <Skeleton className="mt-8 h-32 w-full" />
      <Skeleton className="mt-6 h-24 w-full" />
    </div>
  );
}
