import { useState, useCallback, useEffect } from 'react';
import { apiPublic, buildQuery } from '../../../lib/api';

export function usePublicLakes(initialFilters = {}) {
  const [publicFC, setPublicFC] = useState(null);
  const [activeFilters, setActiveFilters] = useState(initialFilters);
  const [baseKey, setBaseKey] = useState(0);

  const load = useCallback(async (filters = activeFilters) => {
    const qs = buildQuery(filters || {});
    try {
      const fc = await apiPublic(`/public/lakes-geo${qs}`);
      if (fc?.type === 'FeatureCollection') {
        setPublicFC(fc);
      } else {
        setPublicFC({ type: 'FeatureCollection', features: [] });
      }
      setBaseKey(k => k + 1); // force GeoJSON remount
    } catch (e) {
      console.warn('[usePublicLakes] Failed to load lakes', e);
      setPublicFC({ type: 'FeatureCollection', features: [] });
    }
  }, [activeFilters]);

  const applyFilters = useCallback(async (filters) => {
    setActiveFilters(filters || {});
    await load(filters || {});
  }, [load]);

  useEffect(() => { load(initialFilters); }, []); // initial load

  return { publicFC, activeFilters, applyFilters, reload: load, baseKey };
}
