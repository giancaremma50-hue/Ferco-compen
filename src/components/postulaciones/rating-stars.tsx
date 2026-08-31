"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { setRating } from "@/lib/applications/actions";
import { notifyError, notifySuccess } from "@/lib/notifications/toast";
import { RATING_MAX } from "@/lib/applications/schema";

export function RatingStars({ applicationId, rating }: { applicationId: string; rating: number | null }) {
  const [value, setValue] = useState(rating ?? 0);
  const [pending, startTransition] = useTransition();

  function handleClick(next: number) {
    const previous = value;
    // Clic sobre la misma estrella ya activa limpia la calificación.
    const nextValue = next === previous ? 0 : next;
    setValue(nextValue);
    startTransition(async () => {
      const result = await setRating(applicationId, nextValue);
      if (result.error) {
        setValue(previous);
        notifyError(result.error);
      } else {
        notifySuccess(result.success ?? "Calificación guardada");
      }
    });
  }

  return (
    <div className="flex items-center gap-1" aria-busy={pending}>
      {Array.from({ length: RATING_MAX }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          disabled={pending}
          onClick={() => handleClick(n)}
          aria-label={`Calificar con ${n} de ${RATING_MAX}`}
          className="disabled:opacity-50"
        >
          <Star
            className={`size-5 ${n <= value ? "fill-foreground text-foreground" : "text-border"}`}
            aria-hidden
          />
        </button>
      ))}
    </div>
  );
}
