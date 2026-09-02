import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-xl">
      <Skeleton className="h-4 w-24" />
      <div className="mt-4 border border-border bg-card p-6">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="mt-4 h-20 w-full" />
      </div>
    </div>
  );
}
