import "server-only";

/**
 * Limitador en memoria del proceso. 5 peticiones por minuto y por clave.
 *
 * ATENCIÓN — la justificación original de esto quedó obsoleta y se corrige
 * acá: decía "no hay tráfico real todavía que lo exija". Era cierto por el
 * motivo equivocado, /api/postular estaba INALCANZABLE (el proxy lo redirigía
 * a /login, ver PUBLIC_PATHS en lib/supabase/proxy.ts) — el tráfico real era
 * cero por un bug, no por falta de demanda. Desde 2026-09-08 el endpoint
 * recibe de verdad.
 *
 * Lo que eso implica: este Map vive en la memoria de UNA instancia. En Vercel
 * el contador se reinicia con cada instancia nueva y no se comparte entre
 * regiones, así que rotando peticiones por instancias frías se pasa de los
 * 5/min sin esfuerzo. Y /api/postular es el único camino por el que una
 * entrada anónima escribe en Storage con service role (PDFs de hasta 10 MB).
 * El techo sigue siendo aceptable mientras el volumen sea el de un portal de
 * empleos de una empresa, pero ya no por "no hay tráfico": mover esto a una
 * tabla en Postgres o a Upstash es el siguiente paso, anotado en
 * docs/PENDIENTE.md.
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
