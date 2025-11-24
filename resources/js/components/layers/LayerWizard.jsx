import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuthRole } from '../../pages/PublicInterface/hooks/useAuthRole';
import "leaflet/dist/leaflet.css";
import {
  FiUploadCloud, FiCheckCircle, FiMap, FiGlobe, FiAlertTriangle, FiInfo,
} from "react-icons/fi";

import Wizard from "../../components/Wizard";

import {
  boundsFromGeom,
  detectEpsg,
  normalizeForPreview,
  reprojectMultiPolygonTo4326,
  toMultiPolygon,
} from "../../utils/geo";

import { createLayer, fetchLakeOptions, fetchWatershedOptions } from "../../lib/layers";
import { api } from '../../lib/api';
import { alertSuccess, alertError, showLoading, closeLoading, confirm } from "../../lib/alerts";
import { parseSpatialFile, ACCEPTED_EXT_REGEX } from "../../utils/parsers";
import shp from 'shpjs';
import PolygonChooser from '../../components/PolygonChooser';
import FileDropzone from './FileDropzone';
import PreviewMap from './PreviewMap';
import BodySelector from './BodySelector';
import MetadataForm from './MetadataForm';
import PublishControls from './PublishControls';

export default function LayerWizard({
  defaultBodyType = "lake",
  defaultVisibility = "public",
  allowSetActive = false,
  allowedBodyTypes = ["lake", "watershed"],
  visibilityOptions = [
    { value: "public", label: "Public" },
    { value: "admin", label: "Admin" },
  ],
  initialBodyId = "",
  onPublished,
}) {
  const normalizedVisibilityOptions = useMemo(() => {
    const base = Array.isArray(visibilityOptions) && visibilityOptions.length
      ? visibilityOptions
      : [
          { value: "public", label: "Public" },
          { value: "admin", label: "Admin" },
        ];
    return base
      .map((opt) => (typeof opt === "string"
        ? { value: opt, label: opt.charAt(0).toUpperCase() + opt.slice(1) }
        : { value: opt.value, label: opt.label ?? opt.value }
      ))
      .filter((opt) => opt && opt.value);
  }, [visibilityOptions]);

  const resolvedDefaultVisibility = useMemo(() => {
    if (normalizedVisibilityOptions.some((opt) => opt.value === defaultVisibility)) {
      return defaultVisibility;
    }
    return normalizedVisibilityOptions[0]?.value || "public";
  }, [defaultVisibility, normalizedVisibilityOptions]);

  const [data, setData] = useState({
    fileName: "",
    geomText: "",
    uploadGeom: null,
    previewGeom: null,
    sourceSrid: 4326,
    bodyType: allowedBodyTypes.includes(defaultBodyType) ? defaultBodyType : (allowedBodyTypes[0] || "lake"),
    bodyId: initialBodyId ? String(initialBodyId) : "",
    name: "",
    notes: "",
    visibility: resolvedDefaultVisibility,
    isActive: false,
    isDownloadable: false,
    includeViewport: true,
    viewport: null,
    viewportVersion: 0,
  });

  const [error, setError] = useState("");
  const mapRef = useRef(null);
  const wizardSetRef = useRef(null);
  const [lakeOptions, setLakeOptions] = useState([]);
  const [watershedOptions, setWatershedOptions] = useState([]);
  // Use the shared auth hook so UI reacts correctly on refresh/navigation
  const { userRole } = useAuthRole();
  // Multi-feature selection state
  const [pendingFeatures, setPendingFeatures] = useState([]);
  const [pendingCrs, setPendingCrs] = useState(null); // carry CRS from source if provided
  const [pendingFileName, setPendingFileName] = useState("");
  const [featureModalOpen, setFeatureModalOpen] = useState(false);
  const [featureSelectedIdx, setFeatureSelectedIdx] = useState("");
  const [featureMapVersion, setFeatureMapVersion] = useState(0);
  const modalMapRef = useRef(null);

  // Memoize preview-ready geometries (in 4326) for each pending feature so rendering
  // and bounds computation are deterministic and fast during re-renders.
  const previewGeometries = useMemo(() => {
    if (!pendingFeatures || !pendingFeatures.length) return [];
    return pendingFeatures.map((f) => {
      try {
        const mp = toMultiPolygon(f.geometry);
        let srid = null;
        if (pendingCrs) {
          try { srid = detectEpsg({ crs: pendingCrs }); } catch (_) { srid = null; }
        }
        return srid && srid !== 4326 ? reprojectMultiPolygonTo4326(mp, srid) : mp;
      } catch (e) { return null; }
    });
  }, [pendingFeatures, pendingCrs]);

  useEffect(() => {
    if (initialBodyId === undefined || initialBodyId === null || initialBodyId === "") return;
    const nextId = String(initialBodyId);
    setData((prev) => (prev.bodyId === nextId ? prev : { ...prev, bodyId: nextId }));
  }, [initialBodyId]);

  useEffect(() => {
    setData((d) => {
      if (normalizedVisibilityOptions.some((opt) => opt.value === d.visibility)) {
        return d;
      }
      return { ...d, visibility: resolvedDefaultVisibility };
    });
  }, [normalizedVisibilityOptions, resolvedDefaultVisibility]);

  useEffect(() => {
    if (allowSetActive) return;
    setData((d) => (d.isActive ? { ...d, isActive: false } : d));
  }, [allowSetActive]);

  // Map viewport is now controlled by MapViewport inside the Preview render

  // Load lake options (names only) when selecting a lake
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (data.bodyType !== "lake") return;
      try {
        const rows = await fetchLakeOptions("");
        if (!cancelled) setLakeOptions(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.error('[LayerWizard] Failed to load lake options', e);
        if (!cancelled) setLakeOptions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [data.bodyType]);

  // Load watershed options (names only) when selecting a watershed
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (data.bodyType !== "watershed") return;
      try {
        const rows = await fetchWatershedOptions("");
        if (!cancelled) setWatershedOptions(Array.isArray(rows) ? rows : []);
      } catch (e) {
        console.error('[LayerWizard] Failed to load watershed options', e);
        if (!cancelled) setWatershedOptions([]);
      }
    })();
    return () => { cancelled = true; };
  }, [data.bodyType]);

  // -------- file handlers ----------
  const acceptedExt = ACCEPTED_EXT_REGEX;

  // --- Multi-feature helpers ---
  const polygonFeaturesFrom = (root) => {
    if (!root || typeof root !== 'object') return { features: [], crs: null };
    const crs = root.crs || null;
    const t = (root.type || '').toLowerCase();
    const onlyPoly = (f) => f && typeof f === 'object' && f.type === 'Feature' && f.geometry && (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
    if (t === 'featurecollection') {
      const feats = (root.features || []).filter(onlyPoly);
      return { features: feats, crs };
    }
    if (t === 'feature') {
      return onlyPoly(root) ? { features: [root], crs } : { features: [], crs };
    }
    if (t === 'polygon' || t === 'multipolygon') {
      return { features: [{ type: 'Feature', geometry: root, properties: {} }], crs };
    }
    return { features: [], crs };
  };

  const guessFeatureLabel = (feat, idx) => {
    const props = feat?.properties || {};
    const keys = ['name', 'NAME', 'lake', 'lake_name', 'Lake', 'LName', 'id', 'ID'];
    for (const k of keys) {
      if (props[k]) return String(props[k]);
    }
    return `Feature ${idx + 1}`;
  };

  const beginFeatureSelection = (feats, crs, fileName) => {
    setPendingFeatures(feats);
    setPendingCrs(crs || null);
    setPendingFileName(fileName || '');
    setError('Multiple polygons found. Please pick one to continue.');
    // Clear any prior parsed geom to block navigation until selection
    setData((d) => ({ ...d, uploadGeom: null, previewGeom: null, geomText: '', fileName }));
    try { wizardSetRef.current?.({ uploadGeom: null, previewGeom: null, geomText: '', fileName }); } catch (_) {}
  setFeatureSelectedIdx("");
    setFeatureModalOpen(true);
    setFeatureMapVersion((v) => v + 1);
  };

  // When the modal opens, invalidate Leaflet map size to ensure tiles and layers render
  useEffect(() => {
    if (featureModalOpen && modalMapRef.current) {
      setTimeout(() => {
        try { modalMapRef.current.invalidateSize(); } catch (_) {}
      }, 50);
    }
  }, [featureModalOpen]);

  const chooseFeature = (index) => {
    const feat = pendingFeatures[index];
    if (!feat) return;
    // Attach CRS hint (if any) so SRID detection sees it
    const single = { type: 'Feature', geometry: feat.geometry, properties: feat.properties || {} };
    if (pendingCrs) single.crs = pendingCrs;
    // You can pass Feature directly; normalizeForPreview handles Feature
    handleParsedGeoJSON(single, pendingFileName || data.fileName || '');
    setPendingFeatures([]);
    setPendingCrs(null);
    setPendingFileName('');
    setFeatureModalOpen(false);
  };

  const handleParsedGeoJSON = (parsed, fileName = "") => {
    const { uploadGeom, previewGeom, sourceSrid } = normalizeForPreview(parsed);
    setData((d) => ({
      ...d,
      uploadGeom,
      previewGeom,
      sourceSrid,
      geomText: JSON.stringify(parsed, null, 2),
      fileName,
    }));
    setError("");
    // also update wizard internal state so canNext sees the change
    try { wizardSetRef.current?.({ uploadGeom, previewGeom, sourceSrid, geomText: JSON.stringify(parsed, null, 2), fileName }); } catch (e) { /* ignore */ }
  };

  const handleUploadGeoJSON = (parsed, fileName = "") => {
    const { features, crs } = polygonFeaturesFrom(parsed);
    if (!features.length) {
      setError('No Polygon/MultiPolygon geometries found in the file.');
      return;
    }
    if (features.length === 1) {
      const single = { type: 'Feature', geometry: features[0].geometry, properties: features[0].properties || {} };
      if (crs) single.crs = crs;
      handleParsedGeoJSON(single, fileName);
      return;
    }
    // Multiple: let user pick
    beginFeatureSelection(features, crs, fileName);
  };

  const handleFile = async (file) => {
    if (!file) return false;

    const lower = String(file.name || '').toLowerCase();

    // If ZIP, do an early in-browser validation to ensure it contains shapefile layers
    if (lower.endsWith('.zip')) {
      try {
        const buf = await file.arrayBuffer();
        let gj = await shp(buf);
        if (!gj || typeof gj !== 'object') throw new Error('Invalid shapefile contents');
        if (!gj.type && !gj.features) {
          const all = [];
          for (const key of Object.keys(gj)) {
            const layer = gj[key];
            if (layer && Array.isArray(layer.features)) all.push(...layer.features);
          }
          gj = { type: 'FeatureCollection', features: all };
        }
        if (!gj.features || !Array.isArray(gj.features) || gj.features.length === 0) {
          await alertError('Invalid ZIP', 'ZIP contains no shapefile layers or no geometries. Please upload a ZIP containing a valid .shp/.dbf pair.');
          return false;
        }
        // success: handle parsed GeoJSON and let caller know this was accepted
        handleUploadGeoJSON(gj, file.name);
        return true;
      } catch (e) {
        console.error('[LayerWizard] Invalid shapefile zip', e);
        await alertError('Invalid ZIP', 'This ZIP file does not contain a valid shapefile. Please upload a .zip that contains a .shp/.dbf pair.');
        return false;
      }
    }

    if (!acceptedExt.test(file.name)) {
      setError("Only .geojson, .json, .kml, .zip (shapefile), or .gpkg are supported.");
      return false;
    }
    try {
      const gj = await parseSpatialFile(file);
      handleUploadGeoJSON(gj, file.name);
      return true;
    } catch (e) {
      console.error('[LayerWizard] Failed to parse file', e);
      setError(e?.message || "Failed to parse file.");
      await alertError('Failed to parse file', e?.message || 'Failed to parse file.');
      return false;
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])];
    const f = files.find((ff) => acceptedExt.test(ff.name));
    if (f) handleFile(f);
  };
  // -------- publish ----------
  const onPublish = async (wizardData) => {
    setError("");
    try {
      const form = wizardData || data;
      if (!form.uploadGeom) throw new Error("Please upload or paste a valid Polygon/MultiPolygon GeoJSON first.");
      if (!form.bodyType || !form.bodyId) throw new Error("Select a target (lake or watershed) and its ID.");
      if (!form.name) throw new Error("Layer name is required.");
      // Determine source_type from uploaded filename when available
      let sourceType = 'geojson';
      if (form.fileName) {
        const lf = String(form.fileName).toLowerCase();
        if (lf.endsWith('.kml')) sourceType = 'kml';
        else if (lf.endsWith('.zip')) sourceType = 'shp';
        else if (lf.endsWith('.gpkg')) sourceType = 'gpkg';
        else if (lf.endsWith('.geojson') || lf.endsWith('.json')) sourceType = 'geojson';
      }

      const payload = {
        body_type: form.bodyType,
        body_id: Number(form.bodyId),
        name: form.name,
        srid: Number(form.sourceSrid) || 4326,
        visibility: form.visibility, 
        is_downloadable: !!form.isDownloadable,
        status: "ready",
        notes: form.notes || null,
        source_type: sourceType,
        geom_geojson: JSON.stringify(form.uploadGeom),
      };

      // Show loading while publishing
  showLoading('Publishing layer', 'Please wait…');
      const res = await createLayer(payload);
      if (typeof onPublished === "function") onPublished(res);
      await alertSuccess("Layer created successfully.");
    } catch (e) {
      console.error('[LayerWizard] Publish failed', e);
      // Try to produce a friendly, actionable error for admins when the DB unique
      // constraint for a single active layer per body is violated.
      const apiData = e?.response?.data;
      const rawMsg = (typeof apiData === 'string') ? apiData : (apiData?.message || e?.message || '');

      const uniqueDefaultPattern = /uq_layers_active_per_body|duplicate key value|already exists|UniqueConstraint|unique.*\(body_type,\s*body_id\)/i;
      let friendly = rawMsg || 'Failed to publish layer.';
      if (uniqueDefaultPattern.test(String(rawMsg))) {
        friendly = 'There is already an associated layer for this body.';
      } else {
        // If the API returned a more specific nested message, try to surface it without stack traces
        try {
          const parsed = typeof e.message === 'string' ? JSON.parse(e.message) : null;
          const pm = parsed?.message || parsed?.error || null;
          if (pm && typeof pm === 'string' && pm.trim()) {
            friendly = pm.replace(/\r?\n/g, ' ');
          }
        } catch (_) {
          // ignore parse errors
        }
      }

      setError(friendly);
      await alertError('Failed to publish layer', friendly);
    } finally {
      closeLoading();
    }
  };

  // -------- steps ----------
  const previewColor = data.bodyType === "watershed" ? "#16a34a" : "#2563eb";

  const steps = [
  // Step 1: Upload
    {
      key: "upload",
      title: "Upload Spatial File",
      canNext: (d) => !!d.uploadGeom,
      onInvalid: ({ data }) => {
        if (!data.uploadGeom) return alertError('Missing geometry', 'Please upload or select a Polygon/MultiPolygon file before continuing.');
        return null;
      },
    render: ({ data: wdata, setData: wSetData }) => (
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <FiUploadCloud />
              <span>Upload</span>
            </div>
          </div>

          <FileDropzone onFile={handleFile} />


          {pendingFeatures.length > 1 && (
            <div style={{ marginTop: 10 }}>
              <button type="button" className="pill-btn primary" onClick={() => setFeatureModalOpen(true)}>Choose a Polygon</button>
            </div>
          )}
          {wdata.fileName && (
            <div className="info-row" style={{ marginTop: 6 }}>
              <FiInfo /> Loaded: <strong>{data.fileName}</strong>
            </div>
          )}
          {featureModalOpen && pendingFeatures.length > 1 && (
            <PolygonChooser
              open={featureModalOpen}
              onClose={() => setFeatureModalOpen(false)}
              pendingFeatures={pendingFeatures}
              pendingCrs={pendingCrs}
              featureSelectedIdx={featureSelectedIdx}
              setFeatureSelectedIdx={setFeatureSelectedIdx}
              featureMapVersion={featureMapVersion}
              setFeatureMapVersion={setFeatureMapVersion}
              chooseFeature={chooseFeature}
              previewColor={previewColor}
            />
          )}
        </div>
      ),
    },

    // Step 2: Preview
    {
      key: "preview",
      title: "Preview",
    render: ({ data: wdata, setData: wSetData }) => (
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <FiCheckCircle />
              <span>Preview</span>
            </div>
          </div>
          <div className="dashboard-card-body">
            <div className="info-row" style={{ marginBottom: 8 }}>
            </div>
            <PreviewMap
              geometry={wdata.previewGeom}
              color={previewColor}
              viewport={wdata.viewport}
              viewportVersion={wdata.viewportVersion || 0}
              whenCreated={(m) => { if (m && !mapRef.current) mapRef.current = m; }}
            />

          </div>
        </div>
      ),
    },

    // Step 3: Link to Body (UNIFIED: dropdown for both Lake & Watershed)
    {
      key: "link",
      title: "Link to Body",
      canNext: (d) => !!d.bodyId,
      onInvalid: ({ data }) => {
        if (!data.bodyId) return alertError('Missing target', 'Please select a Lake or Watershed to link this layer to.');
        return null;
      },
      onBeforeNext: async ({ data }) => {
        // When user has selected a body, check if it already has existing layers and block proceeding if so.
        try {
          const bt = data.bodyType || 'lake';
          const id = data.bodyId;
          if (!id) return true;
          // query for existing layers attached to this body
          const res = await api(`/layers?body_type=${encodeURIComponent(bt)}&body_id=${encodeURIComponent(id)}&per_page=1`);
          const arr = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          const has = (Array.isArray(arr) && arr.length > 0) || (res?.meta && typeof res.meta.total === 'number' && res.meta.total > 0);
          if (has) {
            await alertError('Layer exists', `This ${bt === 'lake' ? 'lake' : 'watershed'} already has an associated layer. Remove it first before adding another.`);
            return false;
          }
          return true;
        } catch (e) {
          // if check fails, show an error and block progress
          await alertError('Check failed', 'Could not verify existing layers. Please try again.');
          return false;
        }
      },
    render: ({ data: wdata, setData: wSetData }) => (
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <FiMap />
                <span>Link to a {wdata.bodyType === "lake" ? "Lake" : "Watershed"}</span>
            </div>
          </div>
          <div className="dashboard-card-body">
            <BodySelector
              allowedBodyTypes={allowedBodyTypes}
              bodyType={wdata.bodyType}
              onBodyTypeChange={(val) => wSetData((d) => ({ ...d, bodyType: val, bodyId: "" }))}
              bodyId={wdata.bodyId}
              onBodyIdChange={(val) => wSetData((d) => ({ ...d, bodyId: val }))}
              lakeOptions={lakeOptions}
              watershedOptions={watershedOptions}
            />
          </div>
        </div>
      ),
    },

    // Step 4: Metadata
    {
      key: "meta",
      title: "Metadata",
      canNext: (d) => !!d.name,
      onInvalid: ({ data }) => {
        if (!data.name) return alertError('Missing name', 'Layer name is required.');
        return null;
      },
      render: ({ data: wdata, setData: wSetData }) => (
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <FiGlobe />
              <span>Metadata</span>
            </div>
          </div>
          <div className="dashboard-card-body">
            <MetadataForm
              name={wdata.name}
              notes={wdata.notes}
              onChange={(patch) => wSetData((d) => ({ ...d, ...patch }))}
            />
          </div>
        </div>
      ),
    },

    // Step 5: Publish & Visibility
    {
      key: "publish",
      title: "Publish",
      canNext: (d) => !!d.uploadGeom && !!d.bodyType && !!d.bodyId && !!d.name,
      onBeforeFinish: async ({ data }) => {
        // final validation (mirrors onPublish checks) and confirmation prompt
        if (!data.uploadGeom) { alertError('Missing geometry', 'Please upload or select a Polygon/MultiPolygon file before publishing.'); return false; }
        if (!data.bodyType || !data.bodyId) { alertError('Missing target', 'Select a target (lake or watershed) before publishing.'); return false; }
        if (!data.name) { alertError('Missing name', 'Layer name is required before publishing.'); return false; }

        const ok = await confirm({ title: 'Confirm publish', text: 'Publish this layer now?', confirmButtonText: 'Publish' });
        return !!ok;
      },
      render: ({ data: wdata, setData: wSetData }) => (
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <FiGlobe />
              <span>Publish</span>
            </div>
          </div>
          <div className="dashboard-card-body">
            <PublishControls
              visibilityOptions={normalizedVisibilityOptions}
              value={wdata.visibility}
              onChange={(val) => wSetData((d) => ({ ...d, visibility: val }))}
              allowSetActive={allowSetActive}
              isActive={wdata.isActive}
              onToggleActive={() => wSetData((d) => ({ ...d, isActive: !d.isActive }))}
              isDownloadable={wdata.isDownloadable}
              onToggleDownloadable={() => wSetData((d) => ({ ...d, isDownloadable: !d.isDownloadable }))}
            />
            {error && (
              <div className="alert-note" style={{ marginTop: 8 }}>
                <FiAlertTriangle /> {error}
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <Wizard
      steps={steps}
      initialData={data}
      onSetDataRef={(fn) => { wizardSetRef.current = fn; }}
      labels={{ back: "Back", next: "Next", finish: "Publish" }}
      onFinish={onPublish}
  onChange={(payload) => setTimeout(() => setData((d) => ({ ...d, ...payload })), 0)}
    />
  );
}
