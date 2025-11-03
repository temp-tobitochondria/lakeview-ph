// Persistent KPI cache with TTL using localStorage via storageCache,
// with an in-memory fallback provided by storageCache itself.
import cache from './storageCache';

// Default to 5 minutes so values persist across quick navigations
const DEFAULT_TTL = 5 * 60 * 1000;
const NS = 'kpi:'; // per-key namespace under storageCache

export function setKpi(key, value, ttl = DEFAULT_TTL) {
  try {
    cache.set(NS + String(key), value, { ttlMs: Number(ttl) || DEFAULT_TTL });
  } catch (_) {}
}

export function getKpi(key) {
  try {
    const v = cache.get(NS + String(key));
    return v == null ? null : v;
  } catch (_) { return null; }
}

export function clearKpi(key) {
  if (key === undefined) return clearAll();
  try { cache.remove(NS + String(key)); } catch (_) {}
}

export function clearAll() {
  try { cache.clear(NS); } catch (_) {}
}

export default { getKpi, setKpi, clearKpi, clearAll };
