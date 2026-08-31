"use client";

import { ERROR_CATALOG } from "@/lib/errors/catalog";
import { ErrorCard } from "@/components/errors/error-card";

export default function ErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorCard entry={ERROR_CATALOG.desconocido}>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-[42px] items-center justify-center rounded-md border border-primary bg-primary px-5 text-sm font-medium text-primary-foreground"
      >
        Reintentar
      </button>
    </ErrorCard>
  );
}
