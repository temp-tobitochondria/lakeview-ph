// resources/js/pages/AdminInterface/AdminLayers.jsx
import React from "react";
import {
  FiUploadCloud,
  FiLayers,
  FiCheckCircle,
  FiAlertTriangle,
  FiGlobe,
  FiMap,
  FiInfo,
} from "react-icons/fi";

import Wizard from "../../components/Wizard";

/**
 * AdminLayers (scaffold)
 * - Vector-only importer steps
 * - No client parsing; no map preview (until backend is ready)
 * - Overwrite on publish; default visibility: Public
 */
export default function AdminLayers() {
  const steps = [
    /* -------------------------------- Step 1 -------------------------------- */
    {
      key: "upload",
      title: "Upload",
      render: ({ data, setData }) => (
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <FiUploadCloud />
              <span>Upload or Drag & Drop</span>
            </div>
          </div>

          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const files = [...e.dataTransfer.files].filter((f) =>
                /\.(gpkg|geojson|json|kml|zip)$/i.test(f.name)
              );
              setData({ ...data, files });
              // TODO: call backend to stage upload & introspect inner layers
            }}
          >
            <p>Drop files here or click to select</p>
            <small>Accepted: .gpkg, .geojson, .json, .kml, .zip (zipped Shapefile)</small>
            <input
              type="file"
              multiple
              accept=".gpkg,.geojson,.json,.kml,.zip"
              onChange={(e) => {
                const files = [...e.target.files];
                setData({ ...data, files });
                // TODO: call backend to stage upload & introspect inner layers
              }}
            />
          </div>

          <div className="file-list">
            {!data?.files?.length ? (
              <div className="no-data">No files added</div>
            ) : (
              data.files.map((f, i) => (
                <div key={i} className="file-row">
                  <FiMap />
                  <span className="file-name" title={f.name}>{f.name}</span>
                  <button
                    className="action-btn delete"
                    onClick={() => {
                      const copy = [...data.files];
                      copy.splice(i, 1);
                      setData({ ...data, files: copy });
                    }}
                    title="Remove"
                  >
                    <span>Remove</span>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ),
      // no canNext
    },

    /* ------------------------------ Step 2: Select Layers ------------------- */
    {
      key: "select",
      title: "Select Layers",
      render: ({ data, setData }) => (
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <FiLayers />
              <span>Select Layers from Files</span>
            </div>
          </div>
          <div className="dashboard-card-body">
            {!data?.detectedLayers?.length ? (
              <div className="no-data">
                No inner layers detected yet. {/* TODO: populate from backend introspection */}
              </div>
            ) : (
              <ul className="layer-list">
                {data.detectedLayers.map((lyr) => {
                  const selected = new Set(data.selectedLayerIds || []);
                  const isChecked = selected.has(lyr.id);
                  return (
                    <li key={lyr.id} className="layer-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) selected.delete(lyr.id);
                            else selected.add(lyr.id);
                            setData({ ...data, selectedLayerIds: Array.from(selected) });
                          }}
                        />
                        <span className="layer-name">{lyr.name}</span>
                      </label>
                      <span className="layer-meta">
                        {lyr.geomType || "Unknown"}{/* • {lyr.srid || "EPSG:4326"} etc. */}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ),
      // no canNext
    },

    /* ------------------------------ Step 3: Validate & CRS ------------------ */
    {
      key: "validate",
      title: "Validate & CRS",
      render: ({ data, setData }) => (
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <FiCheckCircle />
              <span>Validate & Coordinate System</span>
            </div>
          </div>
          <div className="dashboard-card-body">
            <div className="info-row">
              <FiInfo /> All layers will be reprojected to <strong>EPSG:4326</strong> (WGS84 lat/lon).
            </div>
            <label className="auth-checkbox" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={!!data?.fixInvalidGeoms}
                onChange={(e) => setData({ ...data, fixInvalidGeoms: e.target.checked })}
              />
              <span>Attempt to fix invalid geometries (self-intersections, rings, etc.)</span>
            </label>
            <div className="alert-note">
              <FiAlertTriangle /> Shapefiles must be uploaded as <strong>.zip</strong> with
              <code> .shp/.shx/.dbf/.prj</code>. If <code>.prj</code> is missing, you’ll be asked to choose the CRS.
            </div>
          </div>
        </div>
      ),
      // no canNext
    },

    /* ------------------------------ Step 4: Link to Lake -------------------- */
    {
      key: "link",
      title: "Link to Lake",
      render: ({ data, setData }) => (
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <FiMap />
              <span>Link to a Lake</span>
            </div>
          </div>
          <div className="dashboard-card-body">
            <p>Select the lake this layer belongs to. (Required)</p>
            <select
              value={data?.lakeId || ""}
              onChange={(e) => setData({ ...data, lakeId: e.target.value })}
              className="select-lg"
              aria-label="Select lake"
            >
              <option value="">Choose a lake…</option>
              {/* TODO: populate from /api/lakes when backend is ready */}
            </select>
            <div className="info-row" style={{ marginTop: 8 }}>
              <FiInfo /> Geometry editing of lakes/watersheds/stations is handled on a dedicated page.
            </div>
          </div>
        </div>
      ),
      // no canNext
    },

    /* ------------------------------ Step 5: Metadata & Publish -------------- */
    {
      key: "meta",
      title: "Metadata & Publish",
      render: ({ data, setData }) => (
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div className="dashboard-card-title">
              <FiGlobe />
              <span>Metadata & Publish</span>
            </div>
          </div>
          <div className="dashboard-card-body">
            <div className="org-form">
              <div className="form-group">
                <label>Layer Name</label>
                <input
                  type="text"
                  value={data?.layerName || ""}
                  onChange={(e) => setData({ ...data, layerName: e.target.value })}
                  placeholder="e.g., Lake polygons (admin)"
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={data?.category || "Hydrology"}
                  onChange={(e) => setData({ ...data, category: e.target.value })}
                >
                  <option>Hydrology</option>
                  <option>Administrative</option>
                  <option>Boundaries</option>
                  <option>Bathymetry</option>
                  <option>Reference</option>
                </select>
              </div>

              <div className="form-group" style={{ flexBasis: "100%" }}>
                <label>Description</label>
                <input
                  type="text"
                  value={data?.layerDesc || ""}
                  onChange={(e) => setData({ ...data, layerDesc: e.target.value })}
                  placeholder="Short description / source credits"
                />
              </div>
            </div>

            <div className="org-form" style={{ marginTop: 8 }}>
              <div className="form-group">
                <label>Visibility</label>
                <select
                  value={data?.visibility || "public"}
                  onChange={(e) => setData({ ...data, visibility: e.target.value })}
                >
                  <option value="public">Public (visible on public map)</option>
                  <option value="org">Organization</option>
                  <option value="admin">Admin only</option>
                </select>
              </div>

              <div className="form-group">
                <label>Publish Strategy</label>
                <select value="overwrite" disabled>
                  <option value="overwrite">Overwrite existing (default)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      ),
      // no canNext
    },
  ];

  return (
    <Wizard
      steps={steps}
      initialData={{
        files: [],
        detectedLayers: [],       // to be populated by backend
        selectedLayerIds: [],
        fixInvalidGeoms: true,
        lakeId: "",
        layerName: "",
        layerDesc: "",
        category: "Hydrology",
        visibility: "public",     // per your rule: default visible on public map
      }}
      labels={{ back: "Back", next: "Next", finish: "Publish" }}
      onFinish={(data) => {
        // TODO: call your publish endpoint with data
        // e.g. POST /api/layers/publish
        console.log("Publish payload (scaffold):", data);
        alert("Publish triggered (scaffold). Wire to backend when ready.");
      }}
    />
  );
}
