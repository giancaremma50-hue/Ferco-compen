import { Skeleton } from "@/components/ui/skeleton";

export default function MiCuentaLoading() {
  return (
    <div className="mx-auto max-w-xl">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="mt-2 h-4 w-56" />
      <div className="mt-10">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-5 h-56 w-full" />
      </div>
    </div>
  );
}
