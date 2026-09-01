"use client";

import { ERROR_CATALOG } from "@/lib/errors/catalog";
import { ErrorCard } from "@/components/errors/error-card";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const technicalDetail = error.digest ? `${error.message}\n(digest: ${error.digest})` : error.message;

  return (
    <ErrorCard entry={ERROR_CATALOG.desconocido} motivo="desconocido" technicalDetail={technicalDetail}>
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
