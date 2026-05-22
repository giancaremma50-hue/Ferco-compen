import { Pais } from "@/types";

// ─── Áreas disponibles ────────────────────────────────────────────────────────

export const AREAS = [
  "Comercial",
  "Finanzas",
  "Recursos Humanos",
  "Auditoría",
  "Cajas",
  "Operaciones",
  "Exportaciones",
  "IT",
] as const;

export type Area = (typeof AREAS)[number];

// ─── Jerarquía de cargos ─────────────────────────────────────────────────────
//
// Orden: índice 0 = más alto (sin jefe), índice N = más bajo.
// Comercial varía por país; áreas admin usan "*" (cualquier país).

const COMERCIAL: Record<Pais, string[]> = {
  Guatemala:       ["Director Comercial", "Director Retail", "Regional"],
  "El Salvador":   ["Director Comercial", "Sucursal"],
  Honduras:        ["Director Comercial", "Sucursal"],
  México:          ["Director Comercial", "Regional"],
};

const ADMIN_CHAIN = ["Director", "Gerente"];

export const CARGO_HIERARCHY: Record<Area, Partial<Record<Pais | "*", string[]>>> = {
  Comercial:          COMERCIAL as unknown as Partial<Record<Pais | "*", string[]>>,
  Finanzas:           { "*": ADMIN_CHAIN },
  "Recursos Humanos": { "*": ADMIN_CHAIN },
  Auditoría:          { "*": ADMIN_CHAIN },
  Cajas:              { "*": ADMIN_CHAIN },
  Operaciones:        { "*": ADMIN_CHAIN },
  Exportaciones:      { "*": ADMIN_CHAIN },
  IT:                 { "*": ADMIN_CHAIN },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the ordered list of cargo options for a given área + país.
 * Returns [] when área or país (for Comercial) is not yet selected.
 */
export function getCargoOptions(area: string, pais: string | null): string[] {
  const areaMap = CARGO_HIERARCHY[area as Area];
  if (!areaMap) return [];

  if (area === "Comercial") {
    if (!pais) return [];
    return areaMap[pais as Pais] ?? [];
  }

  return areaMap["*"] ?? [];
}

/**
 * Returns the cargo of the direct manager for the given área + país + cargo.
 * Returns null if the cargo is already at the top of the hierarchy.
 */
export function getSuperiorCargo(
  area: string,
  pais: string | null,
  cargo: string
): string | null {
  const chain = getCargoOptions(area, pais);
  const idx = chain.indexOf(cargo);
  if (idx <= 0) return null; // top level or not found
  return chain[idx - 1];
}

/**
 * Finds the manager in a list of existing users based on the hierarchy rules.
 * Used client-side (no extra Firestore query needed).
 */
export function resolveManager(
  users: Array<{ uid: string; displayName: string; area: string; cargo: string; pais?: string | null }>,
  newUserArea: string,
  newUserPais: string | null,
  newUserCargo: string
): { managerId: string | null; managerName: string | null } {
  const superiorCargo = getSuperiorCargo(newUserArea, newUserPais, newUserCargo);
  if (!superiorCargo) return { managerId: null, managerName: null };

  const match = users.find((u) => {
    if (u.area !== newUserArea) return false;
    if (u.cargo !== superiorCargo) return false;
    // For Comercial, also match by country
    if (newUserArea === "Comercial") return u.pais === newUserPais;
    return true;
  });

  if (!match) return { managerId: null, managerName: null };
  return { managerId: match.uid, managerName: match.displayName };
}
