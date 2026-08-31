import { Skeleton } from "@/components/ui/skeleton";

export default function ApplicationDetailLoading() {
  return (
    <div className="mx-auto grid max-w-4xl gap-10 lg:grid-cols-[1fr_320px]">
      <div>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-2.5 h-9 w-64" />
        <Skeleton className="mt-6 h-5 w-32" />
        <Skeleton className="mt-10 h-24 w-full" />
      </div>
      <div>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    </div>
  );
}
