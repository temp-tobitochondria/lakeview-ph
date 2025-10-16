// ----------------------------------------------------
// Main Map Page Component for LakeView PH
// ----------------------------------------------------
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMap, GeoJSON, Marker, Popup, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
// Turf for spatial ops
import * as turf from "@turf/turf";

import AppMap from "../../components/AppMap";
import MapControls from "../../components/MapControls";
import SearchBar from "../../components/SearchBar";
import LayerControl from "../../components/LayerControl";
import ScreenshotButton from "../../components/Screenshotbutton";
import CoordinatesScale from "../../components/CoordinatesScale"
import Sidebar from "../../components/Sidebar";
import KycPage from "./KycPage";
import ContextMenu from "../../components/ContextMenu";
import MeasureTool from "../../components/MeasureTool";
import LakeInfoPanel from "../../components/LakeInfoPanel";
import AuthModal from "../../components/modals/AuthModal";
import FilterTray from "../../components/FilterTray";
import SearchResultsPopover from "../../components/SearchResultsPopover";
import PublicSettingsModal from "../../components/settings/PublicSettingsModal";
import FeedbackModal from "../../components/feedback/FeedbackModal";
import HeatmapLoadingIndicator from "../../components/HeatmapLoadingIndicator";
import HeatmapLegend from "../../components/HeatmapLegend";
import BackToDashboardButton from "../../components/BackToDashboardButton";
import BaseLakesLayer from "../../components/BaseLakesLayer";
import { useAuthRole } from "./hooks/useAuthRole";
import { usePublicLakes } from "./hooks/usePublicLakes";
import { useLakeSelection } from "./hooks/useLakeSelection";
import { usePopulationHeatmap } from "./hooks/usePopulationHeatmap";
import { useWaterQualityMarkers } from "./hooks/useWaterQualityMarkers";
import { useHotkeys } from "./hooks/useHotkeys";
import DataPrivacyDisclaimer from "./DataPrivacyDisclaimer";
import AboutData from "./AboutData";
import api from "../../lib/api";

function MapWithContextMenu({ children }) {
  const map = useMap();
  return children(map);
}
// ...existing code...

// Bridge component to ensure we capture the Leaflet map instance reliably
function MapRefBridge({ onReady }) {
  const map = useMap();
  useEffect(() => {
    if (map && typeof onReady === 'function') onReady(map);
  }, [map, onReady]);
  return null;
}

// getLakeIdFromFeature no longer used directly in MapPage (handled inside hooks)

function MapPage() {
  // ---------------- State ----------------
  const [selectedView, setSelectedView] = useState("osm");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarPinned, setSidebarPinned] = useState(false);
  const [lakePanelOpen, setLakePanelOpen] = useState(false);
  const [measureActive, setMeasureActive] = useState(false);
  const [measureMode, setMeasureMode] = useState("distance");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false); // data privacy modal
  const [aboutDataOpen, setAboutDataOpenModal] = useState(false); // about data modal
  const [kycOpen, setKycOpen] = useState(false);
  const [filterTrayOpen, setFilterTrayOpen] = useState(false);
  const [aboutDataMenuOpen, setAboutDataMenuOpen] = useState(false);
  const aboutDataMenuOpenRef = React.useRef(false);
  useEffect(() => { aboutDataMenuOpenRef.current = aboutDataMenuOpen; }, [aboutDataMenuOpen]);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchMode, setSearchMode] = useState('suggest'); // 'suggest' | 'results'
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [lastQuery, setLastQuery] = useState("");

  const handleSearch = async (query) => {
    setSearchOpen(true);
    setSearchMode('results');
    setSearchLoading(true);
    setSearchError(null);
    // Clear old results if query changed
    const q = (query || "").trim();
    if (q !== lastQuery) {
      setSearchResults([]);
      setLastQuery(q);
    }
    try {
      const res = await api.post('/search', { query });
      const rows = (res && (res.data || res.rows || res.results)) || [];
      setSearchResults(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setSearchError(e?.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const flyToCoordinates = (gj) => {
    if (!gj || !mapRef.current) return;
    try {
      const feat = typeof gj === 'string' ? JSON.parse(gj) : gj;
      // Support Point centering; for polygons, fit bounds via leaflet
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
  };

  const handleSelectResult = async (item) => {
    if (!item) return;
    // Prefer backend-provided coordinates; fall back to generic geom
    if (item.coordinates_geojson) {
      flyToCoordinates(item.coordinates_geojson);
    } else if (item.geom) {
      flyToCoordinates(item.geom);
    } else if (item.attributes && (item.attributes.coordinates_geojson || item.attributes.geom)) {
      flyToCoordinates(item.attributes.coordinates_geojson || item.attributes.geom);
    }
    // Attempt to select lake on map by id or name
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
            if (b?.isValid?.() && mapRef.current) {
              mapRef.current.flyToBounds(b, { padding: [24,24], maxZoom: 13, duration: 0.8, easeLinearity: 0.25 });
            }
          } catch {}
        }
      }
    } catch {}
    setSearchOpen(false);
  };

  const handleClearSearch = () => {
    setSearchResults([]);
    setSearchError(null);
    setSearchOpen(false);
    setLastQuery("");
    setSearchMode('suggest');
  };

  const navigate = useNavigate();
  const location = useLocation();
  const mapRef = useRef(null);
  // ---------------- Auth / route modal (centralized auth state) ----------------
  const { userRole, authUser, authOpen, authMode, openAuth, closeAuth, setAuthMode } = useAuthRole();

  // Listen for global open-settings events (from Sidebar or elsewhere)
  useEffect(() => {
    const onOpen = () => setSettingsOpen(true);
    window.addEventListener('lv-open-settings', onOpen);
    return () => window.removeEventListener('lv-open-settings', onOpen);
  }, []);

  // Global trigger to open Data Privacy modal
  useEffect(() => {
    const onOpen = () => setPrivacyOpen(true);
    window.addEventListener('lv-open-privacy', onOpen);
    return () => window.removeEventListener('lv-open-privacy', onOpen);
  }, []);

  // Global trigger to open About Data modal
  useEffect(() => {
    const onOpen = () => setAboutDataOpenModal(true);
    window.addEventListener('lv-open-about-data', onOpen);
    return () => window.removeEventListener('lv-open-about-data', onOpen);
  }, []);

  // Support navigation with state { openSettings: true }
  useEffect(() => {
    if (location.pathname === '/' && location.state?.openSettings) {
      setSettingsOpen(true);
      // clear state so back button doesn't reopen repeatedly
      navigate('.', { replace: true, state: {} });
    }
  }, [location, navigate]);

  // Route-based auth/privacy handling
  useEffect(() => {
    const p = location.pathname;
    if (p === '/login') { setAuthMode('login'); openAuth('login'); }
    if (p === '/register') { setAuthMode('register'); openAuth('register'); }
    if (p === '/data/privacy') { setPrivacyOpen(true); }
    if (p === '/data') { setAboutDataOpenModal(true); }
  }, [location.pathname, openAuth, setAuthMode]);
  
  // Keep sidebar open when navigating to /data routes (so submenu doesn't appear collapsed after auto-close)
  useEffect(() => {
    if (/^\/data(\/.*)?$/.test(location.pathname || '')) {
      setSidebarOpen(true);
    }
  }, [location.pathname]);
// Data Privacy Disclaimer integration resolved

  // ---------------- Fetch public lake geometries ----------------
  const { publicFC, activeFilters, applyFilters, baseKey: lakesBaseKey } = usePublicLakes();

  // ---------------- Layers list for selected lake (PUBLIC) ----------------
  const {
    selectedLake, selectedLakeId, watershedToggleOn,
    lakeOverlayFeature, watershedOverlayFeature, lakeLayers, lakeActiveLayerId,
    baseMatchesSelectedLake, baseKeyBump,
    selectLakeFeature, applyOverlayByLayerId, handlePanelToggleWatershed, resetToActive,
    canToggleNominatim, nominatimEnabled, setNominatimEnabled, nominatimLoading,
  } = useLakeSelection({ publicFC, mapRef, setPanelOpen: setLakePanelOpen });

  useHotkeys({ toggleLakePanel: () => setLakePanelOpen(v => !v), closeLakePanel: () => setLakePanelOpen(false) });

  // Compute selected lake bounds (prefer overlay; else from base FeatureCollection)
  const selectedLakeBounds = useMemo(() => {
    try {
      if (lakeOverlayFeature) {
        const gj = L.geoJSON(lakeOverlayFeature); const b = gj.getBounds();
        if (b && b.isValid && b.isValid()) return b;
      }
      if (publicFC && selectedLakeId != null) {
        const getLakeIdFromFeature = (feat) => {
          const p = feat?.properties || {};
          return feat?.id ?? p.id ?? p.lake_id ?? p.lakeId ?? p.lakeID ?? null;
        };
        const f = publicFC.features?.find(ft => {
          const id = getLakeIdFromFeature(ft);
          return id != null && String(id) === String(selectedLakeId);
        });
        if (f) { const gj = L.geoJSON(f); const b = gj.getBounds(); if (b && b.isValid && b.isValid()) return b; }
      }
    } catch {}
    return null;
  }, [lakeOverlayFeature, publicFC, selectedLakeId]);

  const { enabled: heatEnabled, loading: heatLoading, error: heatError, resolution: heatResolution, toggle: togglePopulationHeatmap, clear: clearHeatmap, hasLayer: hasHeatLayer, clearError: clearHeatError } = usePopulationHeatmap({ mapRef, selectedLake, lakeBounds: selectedLakeBounds });

  // population estimate event handling now inside hook

  // auto-refresh handled inside population heatmap hook

  const themeClass = selectedView === "satellite" ? "map-dark" : "map-light";
  const worldBounds = [[4.6,116.4],[21.1,126.6]];

  const { jumpToStation } = useWaterQualityMarkers(mapRef);

  // Flows state
  const [showFlows, setShowFlows] = useState(false);
  // null = loading, [] = loaded but empty, array = loaded
  const [flows, setFlows] = useState(null);
  // fetch flows whenever selected lake changes (so Overview can list even if markers hidden)
  useEffect(()=>{
    let abort = false;
    const load = async () => {
      if (!selectedLakeId) { setFlows([]); return; }
      // indicate loading
      setFlows(null);
      try {
        const res = await fetch(`/api/public/lake-flows?lake_id=${selectedLakeId}`);
        if (!res.ok) return; const js = await res.json();
        if (!abort) setFlows(Array.isArray(js) ? js : []);
      } catch(e) { if (!abort) setFlows([]); }
    };
    load();
    return () => { abort = true; };
  }, [selectedLakeId]);

  const jumpToFlow = (flow) => {
    if (!flow || !mapRef.current) return;
    if (flow.latitude && flow.longitude) {
      mapRef.current.flyTo([flow.latitude, flow.longitude], 14, { duration: 0.6 });
    }
    if (!showFlows) setShowFlows(true);
  };

  // ---------------- Municipal/City choropleth ----------------
  const [showMunicipChoro, setShowMunicipChoro] = useState(false);
  const [municipalLoading, setMunicipalLoading] = useState(false);
  const [municipalError, setMunicipalError] = useState(null);
  const [municipalFeatures, setMunicipalFeatures] = useState([]); // GeoJSON Feature[] of admin_level=6

  // Helper: get polygon for current lake (overlay preferred; else base)
  const selectedLakePolygon = useMemo(() => {
    try {
      const feat = lakeOverlayFeature || (publicFC && selectedLakeId != null ? publicFC.features?.find(ft => {
        const p = ft?.properties || {}; const id = ft?.id ?? p.id ?? p.lake_id ?? p.lakeId ?? p.lakeID ?? null; return id != null && String(id) === String(selectedLakeId);
      }) : null);
      if (!feat) return null;
      const geom = feat.geometry;
      if (!geom || !(geom.type === 'Polygon' || geom.type === 'MultiPolygon')) return null;
      return { type: 'Feature', properties: { name: feat?.properties?.name || 'Lake' }, geometry: geom };
    } catch { return null; }
  }, [lakeOverlayFeature, publicFC, selectedLakeId]);

  // Fetch municipalities when toggled on or lake changes
  useEffect(() => {
    let aborted = false;
    // Helpers to clean/normalize geometries
    const sanitizeFeature = (geom) => {
      try {
        const f0 = { type: 'Feature', properties: {}, geometry: geom };
        // Clean self-intersections using buffer(0)
        let f1 = null; try { f1 = turf.buffer(f0, 0, { units: 'kilometers' }); } catch { f1 = f0; }
        return f1.geometry || geom;
      } catch { return geom; }
    };
    const toPolyOrMulti = (g) => {
      if (!g) return null;
      if (g.type === 'Polygon' || g.type === 'MultiPolygon') return g;
      if (g.type === 'GeometryCollection' && Array.isArray(g.geometries)) {
        const polys = g.geometries.filter(gg => gg && (gg.type === 'Polygon' || gg.type === 'MultiPolygon'));
        if (!polys.length) return null;
        if (polys.length === 1) return polys[0];
        try { const u = turf.union(...polys.map(pg => ({ type:'Feature', properties:{}, geometry: pg }))); return u?.geometry || polys[0]; } catch { return polys[0]; }
      }
      return null;
    };
    const run = async () => {
      if (!showMunicipChoro) { setMunicipalError(null); return; }
      if (!selectedLakePolygon) { setMunicipalFeatures([]); return; }
      try {
    setMunicipalLoading(true); setMunicipalError(null);
  // Use the lake polygon directly for intersection tests (no buffer), sanitized
  const lakePoly = { type:'Feature', properties:{}, geometry: sanitizeFeature(selectedLakePolygon.geometry) };
  const bbox = turf.bbox(lakePoly);
  const [minLon, minLat, maxLon, maxLat] = bbox;
  // Clip area around lake to limit far geometry artifacts after difference
  let clipPoly = null; try { clipPoly = turf.buffer(lakePoly, 12, { units: 'kilometers' }); } catch {}

        // 1) Fetch admin boundaries near the lake via Overpass (relations and ways, admin_level 6-8)
        const pad = 0.02; // ~2 km margin depending on latitude
        const oMinLat = Math.max(-90, minLat - pad);
        const oMinLon = Math.max(-180, minLon - pad);
        const oMaxLat = Math.min(90, maxLat + pad);
        const oMaxLon = Math.min(180, maxLon + pad);
        const overpassQuery = `
          [out:json][timeout:35];
          (
            relation["boundary"="administrative"]["admin_level"="6"](${oMinLat},${oMinLon},${oMaxLat},${oMaxLon});
            way["boundary"="administrative"]["admin_level"="6"](${oMinLat},${oMinLon},${oMaxLat},${oMaxLon});
          );
          out ids tags;`;
        let overpassElems = [];
        try {
          const opRes = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain; charset=UTF-8' },
            body: overpassQuery,
          });
          if (!opRes.ok) throw new Error(`Overpass failed (${opRes.status})`);
          const opJson = await opRes.json();
          overpassElems = Array.isArray(opJson?.elements) ? opJson.elements.filter(e => e && (e.type === 'relation' || e.type === 'way')) : [];
        } catch (e) {
          // Overpass failed; we'll fallback to Nominatim search below
          overpassElems = [];
        }

  let feats = [];

        if (overpassElems.length) {
          // 2) Use Nominatim lookup to fetch polygon geojson + extratags in batches
          const idsAll = overpassElems.map(el => `${el.type === 'way' ? 'W' : 'R'}${el.id}`);
          const chunks = [];
          for (let i = 0; i < idsAll.length; i += 25) chunks.push(idsAll.slice(i, i + 25));
          const seen = new Set();
          for (const ch of chunks) {
            if (aborted) break;
            const ids = ch.join(',');
            const lookupParams = new URLSearchParams({ format: 'jsonv2', polygon_geojson: '1', extratags: '1', osm_ids: ids });
            let luRes = await fetch(`https://nominatim.openstreetmap.org/lookup?${lookupParams.toString()}`, { headers: { 'Accept': 'application/json', 'User-Agent': 'LakeViewPH/1.0 (+https://example.org/contact)' } });
            if (luRes.status === 429) { await new Promise(r => setTimeout(r, 600)); luRes = await fetch(`https://nominatim.openstreetmap.org/lookup?${lookupParams.toString()}`, { headers: { 'Accept': 'application/json', 'User-Agent': 'LakeViewPH/1.0 (+https://example.org/contact)' } }); }
            if (!luRes.ok) { await new Promise(r => setTimeout(r, 200)); continue; }
            const arr = await luRes.json();
            for (const r of Array.isArray(arr) ? arr : []) {
              const gjRaw = r?.geojson; if (!gjRaw || !(['Polygon','MultiPolygon','GeometryCollection'].includes(gjRaw.type))) continue;
                const key = `${r.osm_type || (r.osm_id ? 'R' : 'P')}:${r.osm_id || r.place_id}`;
                if (seen.has(key)) continue; seen.add(key);
                // Clean geometries and ensure polygonal
                const gjPoly = toPolyOrMulti(sanitizeFeature(gjRaw));
                if (!gjPoly) continue;
                let f = { type: 'Feature', geometry: gjPoly, properties: {
                  id: r.place_id || r.osm_id,
                  name: r.display_name?.split(',')[0]?.trim() || r.name || 'Municipality/City',
                  source: 'OpenStreetMap (Nominatim/Overpass)',
                  population: null,
                  population_date: null,
                }};
                // Skip if it doesn't intersect the lake polygon
                try { if (!turf.booleanIntersects(f, lakePoly)) continue; } catch { continue; }
                // Trim (subtract) the lake polygon from the municipality so only land remains
                try {
                  const trimmed = turf.difference(f, lakePoly);
                  if (!trimmed || !trimmed.geometry) continue; // nothing left after subtracting water
                  let trimmedGeom = sanitizeFeature(trimmed.geometry);
                  if (clipPoly) {
                    try {
                      const clipped = turf.intersect({ type:'Feature', properties:{}, geometry: trimmedGeom }, clipPoly);
                      if (clipped && clipped.geometry) trimmedGeom = clipped.geometry;
                    } catch {}
                  }
                  const poly = toPolyOrMulti(trimmedGeom);
                  if (!poly) continue;
                  f = { ...f, geometry: poly };
                } catch (e) {
                  // If difference fails, skip trimming but keep feature if it intersects
                }
              const ex = r?.extratags || {};
              const popStr = ex.population || ex['population:2020'] || ex['population:2015'] || ex['population:2010'] || null;
              const pop = popStr != null ? Number(String(popStr).replace(/[,\s]/g, '')) : null;
              if (Number.isFinite(pop)) {
                f.properties.population = pop;
                const yrKey = Object.keys(ex).find(k => /^population:\d{4}$/.test(k));
                if (yrKey) f.properties.population_date = yrKey.split(':')[1];
              }
              feats.push(f);
            }
          }
        }

        // 3) Fallback to direct Nominatim search if nothing found
        if (!feats.length) {
          // Fallback: try Nominatim search with admin_level=6
          for (const lvl of ['6']) {
            if (feats.length) break;
            const params = new URLSearchParams({
              format: 'jsonv2', polygon_geojson: '1', extratags: '1', bounded: '1',
              viewbox: `${minLon},${maxLat},${maxLon},${minLat}`,
              q: '',
              'osm_tag[boundary]': 'administrative',
              'osm_tag[admin_level]': lvl,
            });
            const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;
            let res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'LakeViewPH/1.0 (+https://example.org/contact)' } });
            if (res.status === 429) { await new Promise(r => setTimeout(r, 600)); res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'LakeViewPH/1.0 (+https://example.org/contact)' } }); }
            if (res.ok) {
              const rows = await res.json();
              for (const r of Array.isArray(rows) ? rows : []) {
                const gjRaw = r?.geojson; const cls = r?.class; const typ = r?.type;
                if (!gjRaw || !(['Polygon','MultiPolygon','GeometryCollection'].includes(gjRaw.type))) continue;
                if (cls && cls !== 'boundary') continue;
                if (typ && typ !== 'administrative') continue;
                // Clean geometry first and ensure polygonal
                const geomClean = toPolyOrMulti(sanitizeFeature(gjRaw)); if (!geomClean) continue;
                let f = { type: 'Feature', geometry: geomClean, properties: {
                  id: r.place_id,
                  name: r.display_name?.split(',')[0]?.trim() || r.name || 'Municipality/City',
                  source: 'OpenStreetMap (Nominatim search)',
                  population: null,
                  population_date: null,
                }};
                const ex = r?.extratags || {};
                const popStr = ex.population || ex['population:2020'] || ex['population:2015'] || ex['population:2010'] || null;
                const pop = popStr != null ? Number(String(popStr).replace(/[\s,]/g, '')) : null;
                if (Number.isFinite(pop)) {
                  f.properties.population = pop;
                  const yrKey = Object.keys(ex).find(k => /^population:\d{4}$/.test(k));
                  if (yrKey) f.properties.population_date = yrKey.split(':')[1];
                }
                try { if (!turf.booleanIntersects(f, lakePoly)) continue; } catch { continue; }
                try {
                  const trimmed = turf.difference(f, lakePoly);
                  if (!trimmed || !trimmed.geometry) continue;
                  let trimmedGeom = sanitizeFeature(trimmed.geometry);
                  if (clipPoly) {
                    try { const clipped = turf.intersect({ type:'Feature', properties:{}, geometry: trimmedGeom }, clipPoly); if (clipped && clipped.geometry) trimmedGeom = clipped.geometry; } catch {}
                  }
                  const poly = toPolyOrMulti(trimmedGeom);
                  if (!poly) continue;
                  f = { ...f, geometry: poly };
                } catch (e) {}
                feats.push(f);
              }
            }
          }
        }

        if (!aborted) setMunicipalFeatures(feats);
      } catch (e) {
        if (!aborted) { setMunicipalError(e?.message || 'Failed to load municipalities'); setMunicipalFeatures([]); }
      } finally {
        if (!aborted) setMunicipalLoading(false);
      }
    };
    run();
    return () => { aborted = true; };
  }, [showMunicipChoro, selectedLakePolygon]);

  const muniStats = useMemo(() => {
    const vals = (municipalFeatures || []).map(f => Number(f.properties?.population)).filter(n => Number.isFinite(n));
    if (!vals.length) return { breaks: [], min: null, max: null };
    const sorted = [...vals].sort((a,b)=>a-b);
    const q = (p) => sorted[Math.min(sorted.length-1, Math.max(0, Math.floor(p * (sorted.length-1))))];
    const breaks = [q(0.2), q(0.4), q(0.6), q(0.8)];
    return { breaks, min: sorted[0], max: sorted[sorted.length-1] };
  }, [municipalFeatures]);

  const muniColor = (pop) => {
    // Heatmap-like palette: light yellow -> orange -> red -> dark red
    if (!Number.isFinite(pop)) return '#9ca3af'; // neutral gray for unknown
    const { breaks } = muniStats;
    const colors = ['#ffffb2', '#fed976', '#fd8d3c', '#f03b20', '#bd0026'];
    if (!breaks.length) return colors[0];
    if (pop <= breaks[0]) return colors[0];
    if (pop <= breaks[1]) return colors[1];
    if (pop <= breaks[2]) return colors[2];
    if (pop <= breaks[3]) return colors[3];
    return colors[4];
  };

  // Dedicated effect for map interaction close logic to avoid stale closures & duplicates
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handlerClick = () => {
      if (sidebarPinned) return;
      if (aboutDataMenuOpenRef.current) return; // keep open when submenu open
      if (/^\/data(\/.*)?$/.test(location.pathname || '')) return; // keep for data routes
      setSidebarOpen(false);
    };
    const handlerDrag = handlerClick;
    map.on('click', handlerClick);
    map.on('dragstart', handlerDrag);
    return () => {
      map.off('click', handlerClick);
      map.off('dragstart', handlerDrag);
    };
  }, [sidebarPinned, location.pathname]);

  return (
    <div className={themeClass} style={{ height: "100vh", width: "100vw", margin: 0, padding: 0, position: 'relative' }}>
  <AppMap view={selectedView} zoomControl={false} whenCreated={(m) => { mapRef.current = m; try { window.lv_map = m; } catch {} }}>
    {/* Ensure mapRef is set even if whenCreated timing varies */}
  <MapRefBridge onReady={(m) => { if (!mapRef.current) { mapRef.current = m; try { window.lv_map = m; } catch {} } }} />
        {/* Base layer of all lakes; hides selected lake when an overlay is active */}
        {publicFC && (
          <BaseLakesLayer
            key={`base-${lakesBaseKey + baseKeyBump}`}
            data={publicFC}
            hidePredicate={baseMatchesSelectedLake}
            onFeatureClick={selectLakeFeature}
          />
        )}

        {/* Watershed overlay (green) */}
        {watershedOverlayFeature && (
          <GeoJSON
            key={`watershed-${watershedOverlayFeature?.properties?.layer_id || 'x'}-${JSON.stringify(watershedOverlayFeature?.geometry ?? {}).length}`}
            data={watershedOverlayFeature}
            style={{ color: '#16a34a', weight: 2, fillOpacity: 0.15 }}
            onEachFeature={(feat, layer) => {
              const nm = feat?.properties?.name || 'Watershed';
              layer.bindTooltip(nm, { sticky: true });
            }}
          />
        )}

        {/* Municipal/City choropleth polygons */}
        {showMunicipChoro && municipalFeatures && municipalFeatures.length > 0 && (
          <GeoJSON
            key={`municip-choro-${municipalFeatures.length}-${municipalFeatures.map(f=>f.properties?.id).join('-')}`}
            data={{ type: 'FeatureCollection', features: municipalFeatures }}
            style={(feat) => {
              const p = feat?.properties || {}; const pop = Number(p.population);
              return { color: '#ffffff', weight: 1, fillOpacity: 0.6, fillColor: muniColor(pop) };
            }}
            onEachFeature={(feat, layer) => {
              const p = feat?.properties || {};
              const name = p.name || 'Municipality/City';
              const pop = Number(p.population);
              const popStr = Number.isFinite(pop) ? pop.toLocaleString() : 'Unknown';
              const dateStr = p.population_date || 'Unknown';
              const src = p.source || 'OpenStreetMap';
              const html = `<div style="min-width:160px"><strong>${name}</strong><br/>Population: ${popStr}<br/>Year: ${dateStr}<br/>Source: ${src}</div>`;
              layer.bindTooltip(html, { sticky: true, direction: 'top' });
              layer.on('mouseover', function () { this.setStyle({ weight: 2.5 }); });
              layer.on('mouseout', function () { this.setStyle({ weight: 1 }); });
            }}
          />
        )}

        {/* Lake overlay (blue by default; violet when from Nominatim) */}
        {lakeOverlayFeature && (
          <GeoJSON
            key={`lake-overlay-${lakeOverlayFeature?.properties?.layer_id || 'x'}-${JSON.stringify(lakeOverlayFeature?.geometry ?? {}).length}`}
            data={lakeOverlayFeature}
            style={() => {
              const isNominatim = (lakeOverlayFeature?.properties?.layer_id === 'nominatim' || lakeOverlayFeature?.properties?.source === 'nominatim');
              return { color: isNominatim ? '#7c3aed' : '#3388ff', weight: 2.5, fillOpacity: 0.20 };
            }}
            onEachFeature={(feat, layer) => {
              const nm = feat?.properties?.name || 'Layer';
              layer.bindTooltip(nm, { sticky: true });
            }}
          />
        )}

        {showFlows && flows && flows.map((f) => {
          const lat = Number(f.latitude);
          const lon = Number(f.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          const isInflow = f.flow_type === 'inflow';
          const color = isInflow ? '#14b8a6' : '#7c3aed'; // teal / purple
          return (
            <CircleMarker
              key={`flow-${f.id}`}
              center={[lat, lon]}
              radius={7}
              pathOptions={{ color: color, fillColor: color, weight: 1, fillOpacity: 0.95 }}
            >
              <Popup>
                <div style={{ minWidth: 160 }}>
                  <strong style={{ textTransform: 'capitalize' }}>{f.flow_type}</strong><br />
                  {f.name || f.source || 'Flow Point'} {f.is_primary ? <em style={{ color: '#fbbf24' }}>★</em> : null}<br />
                  <small>Lat: {lat} Lon: {lon}</small>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          pinned={sidebarPinned}
          setPinned={setSidebarPinned}
          onOpenAuth={(m) => { openAuth(m || 'login'); }}
          onOpenKyc={() => setKycOpen(true)}
          onOpenFeedback={() => { setFeedbackOpen(true); if (!sidebarPinned) setSidebarOpen(false); }}
          onAboutDataToggle={(open) => setAboutDataMenuOpen(open)}
        />

        {/* Context Menu */}
        <MapWithContextMenu>
          {(map) => (
            <ContextMenu
              map={map}
              onMeasureDistance={() => { setMeasureMode("distance"); setMeasureActive(true); }}
              onMeasureArea={() => { setMeasureMode("area"); setMeasureActive(true); }}
            />
          )}
        </MapWithContextMenu>

        {/* Measure Tool */}
        <MeasureTool active={measureActive} mode={measureMode} onFinish={() => setMeasureActive(false)} />
        <CoordinatesScale />
        {/* Map Controls */}
        <MapControls defaultBounds={worldBounds} />
      </AppMap>

      {/* Lake Info Panel */}
  <LakeInfoPanel
        isOpen={lakePanelOpen}
        onClose={() => setLakePanelOpen(false)}
        lake={selectedLake}
        onJumpToStation={jumpToStation}
        onToggleHeatmap={togglePopulationHeatmap}
  onClearHeatmap={clearHeatmap}
  heatEnabled={heatEnabled}
  heatLoading={heatLoading}
        layers={lakeLayers}
        activeLayerId={lakeActiveLayerId}
        onResetToActive={resetToActive}
        onSelectLayer={async (layer) => {
          // Fetch overlay geometry and show it; base feature will be hidden for this lake
          await applyOverlayByLayerId(layer.id, { fit: true });
        }}
        showWatershed={watershedToggleOn}
        canToggleWatershed={Boolean(selectedLake?.watershed_id || selectedLake?.watershedId)}
        onToggleWatershed={handlePanelToggleWatershed}
          canToggleNominatim={canToggleNominatim}
          nominatimEnabled={nominatimEnabled}
          nominatimLoading={nominatimLoading}
          onToggleNominatim={setNominatimEnabled}
          authUser={authUser}
  onToggleFlows={(checked)=>setShowFlows(checked)}
  showFlows={showFlows}
  flows={flows}
  onJumpToFlow={jumpToFlow}
  hasHeatLayer={hasHeatLayer}
  // Municipal choropleth toggle props
  showMunicipChoro={showMunicipChoro}
  onToggleMunicipChoro={setShowMunicipChoro}
  municipalLoading={municipalLoading}
  />

      {/* UI overlays */}
      <SearchBar
        onMenuClick={() => setSidebarOpen(true)}
        onFilterClick={() => setFilterTrayOpen((v) => !v)}
        onSearch={handleSearch}
        onClear={handleClearSearch}
        onTyping={(val) => { setSearchMode('suggest'); if (val && val.length >= 2) { setSearchOpen(false); } }}
        mode={searchMode}
      />
      <SearchResultsPopover
        open={searchOpen}
        results={searchResults}
        loading={searchLoading}
        error={searchError}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSelectResult}
      />
      <FilterTray
        open={filterTrayOpen}
        onClose={() => setFilterTrayOpen(false)}
        onApply={(filters) => applyFilters(filters)}
        initial={activeFilters}
      />
      <LayerControl selectedView={selectedView} setSelectedView={setSelectedView} />
      <ScreenshotButton />
      {heatLoading && <HeatmapLoadingIndicator />}
      {heatError && !heatLoading && (
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1200, background: 'rgba(127,29,29,0.8)', color: '#fff', padding: '8px 10px', borderRadius: 6, fontSize: 12, maxWidth: 220 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Heatmap Error</div>
          <div style={{ lineHeight: 1.3 }}>{heatError}</div>
          <button onClick={clearHeatError} style={{ marginTop: 6, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Dismiss</button>
        </div>
      )}
      {/* Municipalities error toast */}
      {municipalError && showMunicipChoro && !municipalLoading && (
        <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 1200, background: 'rgba(127,29,29,0.8)', color: '#fff', padding: '8px 10px', borderRadius: 6, fontSize: 12, maxWidth: 260 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Municipal Layer Error</div>
          <div style={{ lineHeight: 1.3 }}>{municipalError}</div>
        </div>
      )}
      {/* Municipalities legend */}
      {showMunicipChoro && municipalFeatures && municipalFeatures.length > 0 && (
        <div style={{ position: 'absolute', bottom: 12, right: 12, zIndex: 1200, background: 'rgba(0,0,0,0.55)', color: '#fff', padding: '8px 10px', borderRadius: 6, fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Municipal Population</div>
          {(() => { const { breaks, min, max } = muniStats; const bins = [min, ...breaks, max].filter(v=>v!=null); return (
            <div style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 6 }}>
              {bins.map((b, i) => {
                const next = bins[Math.min(bins.length-1, i+1)];
                const color = muniColor(next ?? b);
                const label = (i < bins.length-1 && next != null) ? `${Number(b).toLocaleString()} – ${Number(next).toLocaleString()}` : `${Number(b).toLocaleString()}+`;
                if (i === bins.length-1) return null;
                return (
                  <React.Fragment key={`bin-${i}`}>
                    <div style={{ width: 14, height: 14, background: color, border: '1px solid #fff' }} />
                    <div>{label}</div>
                  </React.Fragment>
                );
              })}
            </div>
          ); })()}
        </div>
      )}
  {hasHeatLayer && !heatLoading && <HeatmapLegend resolution={heatResolution} />}
      {/* Back to Dashboard */}
      <BackToDashboardButton role={userRole} />

      {/* Settings Modal (public context) */}
      {authUser && (
        <PublicSettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      )}

      {/* Feedback Modal */}
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      {/* Data Privacy Modal */}
      <DataPrivacyDisclaimer
        open={privacyOpen}
        onClose={() => {
          setPrivacyOpen(false);
          if (location.pathname === "/data/privacy") {
            // Return to map after closing modal that was opened via route
            navigate("/", { replace: true });
          }
        }}
      />

      {/* About Data Modal */}
      <AboutData
        open={aboutDataOpen}
        onClose={() => {
          setAboutDataOpenModal(false);
          if (location.pathname === "/data") {
            navigate("/", { replace: true });
          }
        }}
      />

      {/* Auth Modal */}
      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => {
          closeAuth();
          if (location.pathname === '/login' || location.pathname === '/register') {
            navigate('/', { replace: true });
          }
        }}
      />

      {/* KYC modal (embedded) for public users */}
      {kycOpen && authUser && (!authUser.role || authUser.role === 'public') && (
        <KycPage embedded={true} open={kycOpen} onClose={() => setKycOpen(false)} />
      )}
      {/* Control KYC modal visibility via Modal within KycPage using open/close from state if needed */}
    </div>
  );
}

// Attach / reattach map interaction handlers outside of JSX to avoid stale closures / duplicates
// Placed after component so we can reuse internal hooks if reorganized; could also be inside component above return.
// NOTE: We rely on aboutDataMenuOpenRef for real-time state.
MapPage.prototype = {}; // no-op to keep file patch context

// Move effect inside component (must patch above before export) - adjusting by inserting below definition would not work; instead we embed effect earlier.

export default MapPage;
