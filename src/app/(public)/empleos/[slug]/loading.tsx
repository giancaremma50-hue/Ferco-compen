import { Skeleton } from "@/components/ui/skeleton";

export default function EmpleoDetailLoading() {
  return (
    <div className="mx-auto grid max-w-4xl gap-12 px-6 py-16 lg:grid-cols-[1fr_360px]">
      <div>
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/3" />
        <Skeleton className="mt-8 h-32 w-full" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
