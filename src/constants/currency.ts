// Currency configuration per country
export const CURRENCY_SYMBOL: Record<string, string> = {
  Guatemala:    "Q",
  "El Salvador": "$",
  Honduras:     "L",
  México:       "$",
};

export const CURRENCY_CODE: Record<string, string> = {
  Guatemala:    "GTQ",
  "El Salvador": "USD",
  Honduras:     "HNL",
  México:       "USD",
};

export const CURRENCY_LOCALE: Record<string, string> = {
  Guatemala:    "es-GT",
  "El Salvador": "es-SV",
  Honduras:     "es-HN",
  México:       "es-MX",
};

/** Returns the currency symbol for a country, falling back to "$" */
export function getCurrencySymbol(pais: string | undefined | null): string {
  return CURRENCY_SYMBOL[pais ?? ""] ?? "$";
}

/** Formats a number as currency for the given country */
export function formatCurrency(value: number, pais: string | undefined | null): string {
  const currency = CURRENCY_CODE[pais ?? ""] ?? "GTQ";
  const locale   = CURRENCY_LOCALE[pais ?? ""] ?? "es-GT";
  return value.toLocaleString(locale, { style: "currency", currency });
}
