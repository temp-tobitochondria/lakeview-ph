// Global Watersheds API client
// Provides helpers to call watershed, upstream rivers, and flowpath endpoints

const BASES = {
  watershed: 'https://mghydro.com/app/watershed_api',
  rivers: 'https://mghydro.com/app/upstream_rivers_api',
  flowpath: 'https://mghydro.com/app/flowpath_api',
};

function computePrecision(zoom) {
  return (typeof zoom === 'number' && zoom >= 9) ? 'high' : 'low';
}

function buildSearchParams({ lat, lng, zoom }) {
  const precision = computePrecision(zoom);
  const sp = new URLSearchParams();
  sp.set('lat', Number(lat).toFixed(6));
  sp.set('lng', Number(lng).toFixed(6));
  sp.set('precision', precision);
  if (precision === 'high') {
    sp.set('beautify', 'true'); // user preference: Beautify when high precision
  }
  return sp;
}

async function fetchJsonOrThrow(url) {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    let msg = '';
    try { msg = await res.text(); } catch {}
    const err = new Error(msg || `${res.status} ${res.statusText}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function getFlowpath({ lat, lng, zoom }) {
  const sp = buildSearchParams({ lat, lng, zoom });
  const url = `${BASES.flowpath}?${sp.toString()}`;
  return fetchJsonOrThrow(url);
}

export async function getWatershed({ lat, lng, zoom, includeRivers = true }) {
  const sp = buildSearchParams({ lat, lng, zoom });
  const wsUrl = `${BASES.watershed}?${sp.toString()}`;
  const rvUrl = `${BASES.rivers}?${sp.toString()}`;

  const wsPromise = fetchJsonOrThrow(wsUrl);
  if (!includeRivers) {
    const watershed = await wsPromise;
    return { watershed, rivers: null };
  }

  const [watershed, rivers] = await Promise.allSettled([
    wsPromise,
    fetchJsonOrThrow(rvUrl),
  ]).then((results) => {
    const ws = results[0].status === 'fulfilled' ? results[0].value : null;
    const rv = results[1].status === 'fulfilled' ? results[1].value : null;
    if (!ws) {
      const reason = results[0].status === 'rejected' ? (results[0].reason?.message || 'Watershed failed') : 'Watershed failed';
      const err = new Error(reason);
      err.status = results[0].reason?.status;
      throw err;
    }
    return [ws, rv];
  });

  return { watershed, rivers };
}
