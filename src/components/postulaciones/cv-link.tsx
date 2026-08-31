import { getSignedCvUrl } from "@/lib/candidates/get-signed-cv-url";

/**
 * Server Component: la URL firmada solo tiene sentido en el momento en que
 * se sirve el HTML — es el trade-off aceptado de "nunca URL pública, siempre
 * firmada de 60s" (si el usuario tarda más de 60s en hacer clic, falla).
 */
export async function CvLink({ cvFilePath }: { cvFilePath: string | null }) {
  if (!cvFilePath) return <p className="text-sm text-muted-foreground">Sin CV adjunto.</p>;
  const url = await getSignedCvUrl(cvFilePath);
  if (!url) return <p className="text-sm text-muted-foreground">No se pudo generar el enlace del CV.</p>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-sm font-medium text-accent underline">
      Ver CV (enlace válido por 60 segundos)
    </a>
  );
}
