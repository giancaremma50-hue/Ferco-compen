import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="border border-border bg-card p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="mb-3 h-14 w-full" />
      ))}
    </div>
  );
}
