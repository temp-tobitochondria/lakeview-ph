import L from 'leaflet';
import 'leaflet.vectorgrid';

// Simple heat-style color ramp from low (transparent/blue) to high (red)
function colorForIntensity(t) {
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const v = clamp(t);
  // Gradient stops
  // 0.0 -> transparent, 0.2 -> #3b82f6, 0.4 -> #22d3ee, 0.6 -> #a3e635, 0.8 -> #fde047, 1.0 -> #ef4444
  const stops = [
    { p: 0.00, c: [0, 0, 0, 0] },
    { p: 0.20, c: [59, 130, 246, 0.35] }, // blue
    { p: 0.40, c: [34, 211, 238, 0.45] }, // cyan
    { p: 0.60, c: [163, 230, 53, 0.55] }, // lime
    { p: 0.80, c: [253, 224, 71, 0.65] }, // yellow
    { p: 1.00, c: [239, 68, 68, 0.8] },   // red
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 1; i < stops.length; i++) { if (v <= stops[i].p) { b = stops[i]; a = stops[i - 1]; break; } }
  const t2 = (v - a.p) / Math.max(1e-6, (b.p - a.p));
  const ch = (i) => Math.round(a.c[i] + (b.c[i] - a.c[i]) * t2);
  const alpha = a.c[3] + (b.c[3] - a.c[3]) * t2;
  return `rgba(${ch(0)}, ${ch(1)}, ${ch(2)}, ${alpha.toFixed(3)})`;
}

// Convert a raw population value into an intensity [0,1]
// Uses log compression against a reference max to cope with outliers.
function intensityFromValue(val, refMax = 500) {
  const v = Math.max(0, Number(val) || 0);
  const m = Math.max(1, Number(refMax) || 1);
  // log1p normalization
  return Math.min(1, Math.log1p(v) / Math.log1p(m));
}

/**
 * Create a VectorGrid.Protobuf tile layer for population heat visualization.
 * Expects the MVT features to include a numeric population property. We'll
 * try common keys: 'pop', 'val', 'value', 'p'.
 */
export function createPopTileLayer({ lakeId, year, radiusKm, layerId }, opts = {}) {
  const refMax = opts.refMax || 500; // tune as needed
  const tileUrl = `/api/tiles/pop/{z}/{x}/{y}?lake_id=${encodeURIComponent(lakeId)}&radius_km=${encodeURIComponent(radiusKm)}&year=${encodeURIComponent(year)}${layerId ? `&layer_id=${encodeURIComponent(layerId)}` : ''}`;

  const styleFn = (properties, zoom) => {
    // try multiple keys to be robust to server attribute naming
    const raw = properties?.pop ?? properties?.val ?? properties?.value ?? properties?.p ?? 0;
    const t = intensityFromValue(raw, refMax);
    const col = colorForIntensity(t);
    return {
      fill: true,
      fillColor: col,
      fillOpacity: 1,
      stroke: false,
      // If the tile emits points as small squares, weight can adjust outline if stroke enabled
      // weight: 0,
    };
  };

  const layer = L.vectorGrid.protobuf(tileUrl, {
    // Let Leaflet handle requests/caching as you pan/zoom
    maxNativeZoom: 17,
    vectorTileLayerStyles: {
      // Apply to any unknown layer names too
      pop: styleFn,
      default: styleFn,
    },
    interactive: false,
    // performance flags
    rendererFactory: L.canvas.tile,
  });

  return layer;
}
