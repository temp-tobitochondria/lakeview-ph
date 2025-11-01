import { useState, useCallback } from 'react';
import L from 'leaflet';
import api from '../../../lib/api';

export default function usePublicSearch({ mapRef, publicFC, selectLakeFeature, setLakePanelOpen }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState('suggest');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [lastQuery, setLastQuery] = useState("");

  const flyToCoordinates = useCallback((gj) => {
    if (!gj || !mapRef?.current) return;
    try {
      const feat = typeof gj === 'string' ? JSON.parse(gj) : gj;
      if (feat && feat.type === 'Point' && Array.isArray(feat.coordinates)) {
        const [lon, lat] = feat.coordinates;
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          mapRef.current.flyTo([lat, lon], 12, { duration: 1, easeLinearity: 0.75 });
        }
      } else if (feat && (feat.type === 'Polygon' || feat.type === 'MultiPolygon' || feat.type === 'LineString' || feat.type === 'MultiLineString')) {
        try {
          const g = { type: 'Feature', properties: {}, geometry: feat };
          const gjL = L.geoJSON(g);
          const b = gjL.getBounds();
          if (b?.isValid?.()) {
            mapRef.current.flyToBounds(b, { padding: [24,24], maxZoom: 13, duration: 0.8, easeLinearity: 0.25 });
          }
        } catch {}
      }
    } catch {}
  }, [mapRef]);

  const handleSearch = useCallback(async (arg) => {
    const query = typeof arg === 'string' ? arg : (arg?.query ?? '');
    const entity = typeof arg === 'object' ? (arg?.entity || undefined) : undefined;
    setSearchOpen(true);
    setSearchMode('results');
    setSearchLoading(true);
    setSearchError(null);
    const q = (query || "").trim();
    if (q !== lastQuery) {
      setSearchResults([]);
      setLastQuery(q);
    }
    try {
      const body = entity ? { query, entity } : { query };
      const res = await api.post('/search', body);
      const rows = (res && (res.data || res.rows || res.results)) || [];
      setSearchResults(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setSearchError(e?.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, [lastQuery]);

  const handleSelectResult = useCallback(async (item) => {
    if (!item) return;
    if (item.coordinates_geojson) {
      flyToCoordinates(item.coordinates_geojson);
    } else if (item.geom) {
      flyToCoordinates(item.geom);
    } else if (item.attributes && (item.attributes.coordinates_geojson || item.attributes.geom)) {
      flyToCoordinates(item.attributes.coordinates_geojson || item.attributes.geom);
    }
    try {
      const entity = (item.table || item.entity || '').toString();
      const id = item.id || item.lake_id || item.body_id || null;
      const nm = (item.name || (item.attributes && (item.attributes.name || item.attributes.lake_name)) || '').trim();
      if (entity === 'lakes' && publicFC && publicFC.features && publicFC.features.length) {
        const getId = (ft) => ft?.id ?? ft?.properties?.id ?? ft?.properties?.lake_id ?? null;
        let target = publicFC.features.find(ft => id != null && getId(ft) != null && String(getId(ft)) === String(id));
        if (!target && nm) {
          const nmLower = nm.toLowerCase();
          target = publicFC.features.find(ft => String(ft?.properties?.name || '').toLowerCase() === nmLower);
        }
        if (target) {
          try {
            const gj = L.geoJSON(target);
            const b = gj.getBounds();
            if (b?.isValid?.() && mapRef?.current) {
              mapRef.current.flyToBounds(b, { padding: [24,24], maxZoom: 13, duration: 0.8, easeLinearity: 0.25 });
            }
            try { selectLakeFeature(target); } catch {}
            setLakePanelOpen(true);
          } catch {}
        }
      }
    } catch {}
    setSearchOpen(false);
  }, [publicFC, selectLakeFeature, mapRef, setLakePanelOpen, flyToCoordinates]);

  const handleClearSearch = useCallback(() => {
    setSearchResults([]);
    setSearchError(null);
    setSearchOpen(false);
    setLastQuery("");
    setSearchMode('suggest');
  }, []);

  return {
    searchOpen, setSearchOpen,
    searchMode, setSearchMode,
    searchLoading, searchError, searchResults, lastQuery,
    handleSearch, handleSelectResult, handleClearSearch,
  };
}
