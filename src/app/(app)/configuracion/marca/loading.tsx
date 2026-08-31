import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-8 lg:grid-cols-[560px_1fr]">
      <div className="border border-border bg-card p-6">
        <Skeleton className="h-6 w-40" />
        <div className="mt-6 flex flex-col gap-5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
      <Skeleton className="h-[340px] w-full" />
    </div>
  );
}
