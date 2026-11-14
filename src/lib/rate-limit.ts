/**
 * A fixed-window counter per key (an IP address), kept in memory. Each server instance counts
 * on its own, so this stops one client hammering an instance rather than enforcing an exact
 * global limit. Vercel's firewall rate-limit rules are the layer for that.
 */
export interface Limiter {
  check(key: string, now?: number): { ok: boolean; retryAfter: number };
}

export function createLimiter({
  limit,
  windowMs = 60_000,
  maxKeys = 10_000,
}: {
  /** Allowed hits per key per window. A function so tests and env changes apply without a restart. */
  limit: number | (() => number);
  windowMs?: number;
  maxKeys?: number;
}): Limiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    check(key, now = Date.now()) {
      let entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        if (hits.size >= maxKeys) {
          for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
          // Still full: forget the oldest key rather than grow without bound.
          if (hits.size >= maxKeys) hits.delete(hits.keys().next().value!);
        }
        entry = { count: 0, resetAt: now + windowMs };
        hits.set(key, entry);
      }
      entry.count++;
      const max = typeof limit === "function" ? limit() : limit;
      return entry.count <= max
        ? { ok: true, retryAfter: 0 }
        : { ok: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
    },
  };
}

/** Lookups that reach OpenWeather per IP per minute. Override with SKYCAST_LOOKUPS_PER_MINUTE. */
export function lookupsPerMinute(fallback: number): number {
  const value = Number(process.env.SKYCAST_LOOKUPS_PER_MINUTE);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
