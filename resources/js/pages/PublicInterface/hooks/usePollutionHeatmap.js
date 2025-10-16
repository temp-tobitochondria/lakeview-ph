import { useState, useRef, useCallback, useEffect } from 'react';
import L from 'leaflet';
import { createHeatLayer, fetchPollutionPointsProgressive } from '../../../map/pollutionHeat';

export function usePollutionHeatmap({ mapRef, selectedLake, lakeBounds = null }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resolution, setResolution] = useState(null); // 'preview' | 'final'
  const paramsRef = useRef({ parameter: 'overall', agg: 'latest', from: null, to: null });
  const heatLayerRef = useRef(null);
  const debounceRef = useRef(null);
  const abortRef = useRef(null);
  const inFlightRef = useRef(false);

  const clearLayer = () => {
    const map = mapRef?.current;
    if (map && heatLayerRef.current) { try { map.removeLayer(heatLayerRef.current); } catch {} }
    heatLayerRef.current = null;
  };

  const clear = useCallback(() => {
    if (abortRef.current) { try { abortRef.current.abort(); } catch {} abortRef.current = null; }
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    setLoading(false); setResolution(null); setError(null);
    clearLayer();
  }, [mapRef]);

  const runFetch = useCallback(() => {
    const map = mapRef?.current;
    if (!map || !paramsRef.current || !selectedLake?.id) return;
    if (inFlightRef.current && abortRef.current) { try { abortRef.current.abort(); } catch {} }
    const controller = new AbortController();
    abortRef.current = controller;
    const zoom = map.getZoom?.() || 10;
    const maxPoints = zoom >= 13 ? 6000 : zoom >= 11 ? 5000 : zoom >= 9 ? 3500 : 2500;
    const smallPoints = Math.min(1200, Math.floor(maxPoints / 4));
    const b = map.getBounds();
    const sw = b.getSouthWest(); const ne = b.getNorthEast();
    const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
    const params = {
      lakeId: selectedLake.id,
      parameter: paramsRef.current.parameter,
      from: paramsRef.current.from,
      to: paramsRef.current.to,
      agg: paramsRef.current.agg,
      bbox,
      maxPoints,
      smallPoints,
    };
    inFlightRef.current = true;
    setLoading(true); setResolution(null); setError(null);
    const runner = fetchPollutionPointsProgressive(params, {
      onIntermediate: (payload) => {
        const pts = payload?.normalized || [];
        if (!heatLayerRef.current) {
          const layer = createHeatLayer(pts);
          heatLayerRef.current = layer; layer.addTo(map);
        } else { heatLayerRef.current.__setData?.(pts); }
        setResolution('preview');
      },
      onFinal: (payload) => {
        const pts = payload?.normalized || [];
        if (heatLayerRef.current) { heatLayerRef.current.__setData?.(pts); }
        else { const layer = createHeatLayer(pts); heatLayerRef.current = layer; layer.addTo(map); }
        setLoading(false); setResolution('final'); setError(null);
      },
      onError: (e) => {
        if (e?.name === 'AbortError') return;
        setLoading(false); setResolution(null); setError('Failed to load pollution points');
      }
    }, { signal: controller.signal });
    controller.signal.addEventListener('abort', () => setLoading(false));
    runner.promise.finally(() => { inFlightRef.current = false; });
  }, [mapRef, selectedLake]);

  const toggle = useCallback((on, opts = {}) => {
    const map = mapRef?.current;
    if (!map) return;
    if (!on) {
      setEnabled(false); setLoading(false); setResolution(null); setError(null);
      if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
      if (abortRef.current) { try { abortRef.current.abort(); } catch {} abortRef.current = null; }
      clearLayer();
      return;
    }
    if (!selectedLake?.id) return;
    const hasExplicit = opts && (typeof opts.parameter !== 'undefined' || typeof opts.from !== 'undefined' || typeof opts.to !== 'undefined' || typeof opts.agg !== 'undefined');
    const next = hasExplicit ? {
      parameter: opts.parameter ?? 'overall',
      from: opts.from ?? null,
      to: opts.to ?? null,
      agg: opts.agg ?? 'latest',
    } : (paramsRef.current || { parameter: 'overall', from: null, to: null, agg: 'latest' });
    paramsRef.current = next;
    setEnabled(true);
    if (opts.loading) setLoading(true);
    runFetch();
  }, [runFetch, selectedLake]);

  // React to map zoom when enabled
  useEffect(() => {
    const map = mapRef?.current;
    if (!map || !enabled) return;
    const schedule = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          if (lakeBounds && typeof map.getBounds === 'function') {
            const v = map.getBounds();
            if (v && v.contains && v.contains(lakeBounds)) {
              return; // skip refetch if entire lake visible
            }
          }
        } catch {}
        runFetch();
      }, 200);
    };
    map.on('zoomend', schedule);
    return () => { try { map.off('zoomend', schedule); } catch {}; if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [enabled, runFetch, lakeBounds]);

  // Reset when selected lake changes
  useEffect(() => {
    if (abortRef.current) { try { abortRef.current.abort(); } catch {} abortRef.current = null; }
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    clearLayer(); setLoading(false); setResolution(null); setError(null); setEnabled(false);
  }, [selectedLake?.id]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (abortRef.current) { try { abortRef.current.abort(); } catch {} }
    if (debounceRef.current) { clearTimeout(debounceRef.current); }
    clearLayer();
  }, []);

  const clearError = () => setError(null);
  const hasLayer = !!heatLayerRef.current;
  return { enabled, loading, error, resolution, toggle, clear, hasLayer, clearError };
}
