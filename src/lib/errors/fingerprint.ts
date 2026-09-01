import "server-only";
import { createHash } from "node:crypto";

/** Agrupa reportes repetidos del mismo problema sin exponer el mensaje crudo. */
export function buildFingerprint(code: string, message: string): string {
  return createHash("sha256").update(`${code}:${message}`).digest("hex").slice(0, 16);
}
