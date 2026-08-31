import "server-only";

/**
 * Limitador en memoria del proceso — suficiente para Vercel en v1 porque el
 * endpoint público (/api/postular) es de bajo volumen (postulaciones, no
 * tráfico general) y una función serverless individual vive varios minutos
 * bajo carga sostenida antes de reciclarse. Si el volumen crece o se corre
 * en múltiples regiones simultáneas, esto necesita moverse a una tabla en
 * Postgres o a Upstash Redis — no es un bug a corregir ahora, no hay
 * tráfico real todavía que lo exija.
 */
const hits = new Map<string, { count: number; resetAt: number }>();
const SWEEP_THRESHOLD = 500;

// Cada IP nueva que pega al endpoint público deja una entrada que solo se
// sobreescribe si esa misma IP vuelve — sin esto, tráfico sostenido de
// bots/scanners hace crecer el Map indefinidamente durante la vida del
// proceso. Barrer todo el Map en cada llamada sería caro; se hace solo
// cuando ya creció lo suficiente como para que valga la pena.
function sweepExpired(now: number) {
  if (hits.size < SWEEP_THRESHOLD) return;
  for (const [key, entry] of hits) {
    if (entry.resetAt < now) hits.delete(key);
  }
}

export function checkRateLimit(key: string, opts: { max?: number; windowMs?: number } = {}): boolean {
  const max = opts.max ?? 5;
  const windowMs = opts.windowMs ?? 60_000;
  const now = Date.now();

  sweepExpired(now);

  const entry = hits.get(key);

  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}
