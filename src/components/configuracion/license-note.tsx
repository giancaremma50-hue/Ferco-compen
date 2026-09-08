/**
 * Recordatorio de procedencia junto a cada campo de subida de marca.
 *
 * Es lo único que el software puede hacer por el copyright de las imágenes:
 * verificar de dónde salió un archivo subido no es algo que el código pueda
 * comprobar. La auditoría de 2026-09-08 encontró el proyecto limpio (fuentes
 * OFL, iconos ISC, `public/` vacía, cero stock), así que el riesgo es
 * enteramente futuro — entra con lo que suba el cliente.
 *
 * En un solo componente y no repetido en cada campo: la frase la comparten
 * los 6 puntos de subida de `/configuracion/marca` y así no se desvía.
 */
export function LicenseNote({ dark = false }: { dark?: boolean }) {
  return (
    <p className={`text-[11px] leading-snug ${dark ? "text-primary-foreground/50" : "text-muted-foreground/80"}`}>
      Sube solo material propio o con licencia de uso comercial.
    </p>
  );
}
