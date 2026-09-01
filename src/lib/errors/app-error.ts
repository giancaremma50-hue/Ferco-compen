/**
 * Next sanea el error antes de que cruce a error.tsx en producción (solo
 * `message` genérico + `digest` llegan al cliente) — así que `code` nunca
 * se ve en la UI. El valor real de lanzar `AppError` en vez de `Error` es
 * que el `console.error` del lado servidor (antes de que Next sanee nada)
 * queda correlacionado con un código de catálogo, no solo con un digest.
 */
export class AppError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "AppError";
  }
}
