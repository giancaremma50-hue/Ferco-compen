"use client";

import Link from "next/link";
import { deleteSegment } from "@/lib/candidates/segments-actions";
import { DeleteButton } from "@/components/ui/delete-button";
import type { CandidateSegment } from "@/lib/candidates/get-segments";

export function SegmentList({ segments }: { segments: CandidateSegment[] }) {
  if (segments.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {segments.map((s) => {
        const params = new URLSearchParams(
          Object.entries(s.filters).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        );
        return (
          <div key={s.id} className="flex items-center gap-1 rounded-full border border-border py-1 pr-1 pl-3 text-xs">
            <Link href={`/candidatos?${params.toString()}`} className="hover:underline">
              {s.name}
            </Link>
            <DeleteButton
              itemLabel={`el segmento "${s.name}"`}
              iconOnly
              className="h-5 w-5 border-none"
              onDelete={() => deleteSegment(s.id)}
              successMessage="Segmento eliminado"
            />
          </div>
        );
      })}
    </div>
  );
}
