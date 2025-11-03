// resources/js/lib/httpCache.js
// Small HTTP GET cache built on top of storageCache and the existing api client.
// Goals:
// - Persist list/options data across page switches so we avoid unnecessary refetches
// - TTL-based staleness; callers can control ttlMs
// - Simple invalidation by URL prefix after mutations

import cache from './storageCache';
import api, { buildQuery } from './api';

const CACHE_NS = 'http:'; // prefixes cache keys under storageCache namespace
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// In-flight dedupe to avoid concurrent duplicate requests
const IN_FLIGHT = new Map(); // key -> Promise

function canonicalQuery(params = {}) {
  try {
    const entries = [];
    for (const [k, v] of Object.entries(params || {})) {
      if (v === undefined || v === null || v === '') continue;
      if (Array.isArray(v)) {
        for (const vv of v) entries.push([k, String(vv)]);
      } else {
        entries.push([k, String(v)]);
      }
    }
    entries.sort((a, b) => {
      if (a[0] === b[0]) return String(a[1]).localeCompare(String(b[1]));
      return String(a[0]).localeCompare(String(b[0]));
    });
    const usp = new URLSearchParams();
    for (const [k, v] of entries) usp.append(k, v);
    const s = usp.toString();
    return s ? `?${s}` : '';
  } catch {
    // Fallback to api.buildQuery (may not be fully stable ordering but OK)
    try { return buildQuery(params) || ''; } catch { return ''; }
  }
}

function makeKey(method, url, params, authKey) {
  const qs = canonicalQuery(params);
  // Include auth flag so public vs authed responses don't collide
  const auth = authKey ? 'a' : 'p';
  // storageCache adds its own prefix; we keep an inner namespace to allow partial clears
  return `${CACHE_NS}${method}:${url}${qs}:${auth}`;
}

export async function cachedGet(url, { params, ttlMs = DEFAULT_TTL, auth } = {}) {
  const authKey = auth === false ? 0 : 1; // default matches api (auth on if token exists)
  const key = makeKey('GET', url, params, authKey);

  // Serve fresh cache when available
  const hit = cache.get(key, { maxAgeMs: ttlMs });
  if (hit != null) return hit;

  // Dedupe concurrent identical GETs
  if (IN_FLIGHT.has(key)) {
    return IN_FLIGHT.get(key);
  }

  const p = (async () => {
    const res = await api.get(url, { params, auth });
    try { cache.set(key, res, { ttlMs }); } catch {}
    return res;
  })();

  IN_FLIGHT.set(key, p);
  try {
    const data = await p;
    return data;
  } finally {
    IN_FLIGHT.delete(key);
  }
}

// Clear cached responses. Accepts string or array of strings.
// Each string should be a URL path prefix like '/admin/users' or '/lakes'.
export function invalidateHttpCache(prefixes) {
  const list = Array.isArray(prefixes) ? prefixes : [prefixes];
  for (const raw of list) {
    if (!raw) continue;
    // We clear both auth variants and any query variants by using startsWith on our inner namespace.
    try { cache.clear(`${CACHE_NS}GET:${raw}`); } catch {}
  }
}

export default { cachedGet, invalidateHttpCache };

