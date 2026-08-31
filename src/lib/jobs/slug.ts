import { nanoid } from "nanoid";

const ACCENTS: Record<string, string> = {
  á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u", ñ: "n",
};

/**
 * Título legible + sufijo aleatorio, sin round-trip a la base para chequear
 * disponibilidad. La unicidad real la exige el índice único parcial
 * jobs_org_slug_key (organization_id, slug) — una colisión (extremadamente
 * improbable) hace fallar el INSERT con un error genérico y reintentable,
 * nunca crea un duplicado silencioso.
 */
export function generateJobSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[áéíóúüñ]/g, (char) => ACCENTS[char] ?? char)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "vacante"}-${nanoid(6).toLowerCase()}`;
}
