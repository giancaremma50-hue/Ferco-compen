import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-3 h-11 w-80" />
      <Skeleton className="mt-4 h-4 w-96 max-w-full" />
    </div>
  );
}
