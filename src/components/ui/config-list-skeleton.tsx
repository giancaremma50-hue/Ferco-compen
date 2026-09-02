import { Skeleton } from "@/components/ui/skeleton";

/** Forma repetida por toda página de configuración con lista simple (motivos, plantillas, etc.) — encabezado + N filas. */
export function ConfigListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="border border-border bg-card p-5">
      <Skeleton className="h-6 w-56" />
      <div className="mt-6 flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
