import { Skeleton } from "@/components/ui/skeleton";

export default function NotificacionesLoading() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-10 w-48" />
      </div>
      <div className="mt-8 grid gap-px">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
