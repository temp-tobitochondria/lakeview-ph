// resources/js/pages/OrgInterface/OrgLayers.jsx
import React from "react";
import {
  FiUploadCloud,
  FiLayers,
  FiCheckCircle,
  FiAlertTriangle,
  FiGlobe,
  FiMap,
  FiInfo,
  FiShield,
  FiUsers,
} from "react-icons/fi";

import Wizard from "../../components/Wizard";

/**
 * OrgLayers (scaffold)
 * - Organization-scoped vector layer importer (same UX as Admin, but org-specific rules)
 * - Vector-only: .gpkg, .geojson/.json, .kml, .zip (zipped Shapefile)
 * - No client parsing / map preview in this scaffold (wire to backend later)
 * - Default visibility: Organization
 * - If "Public" is selected, treat as "Submit for admin approval"
 * - Link to a lake (limited to lakes your org manages; populate when backend is ready)
 * - No canNext preconditions so you can step through the entire wizard
 */
export default function OrgLayers() {
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
              // TODO: POST to /api/org/layers/stage to upload & introspect inner layers
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
                // TODO: POST to /api/org/layers/stage to upload & introspect inner layers
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
                  <span className="file-name" title={f.name}>
                    {f.name}
                  </span>
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
      // canNext omitted on purpose so you can step through
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
                No inner layers detected yet.
                <br />
                <small>These will appear once the backend inspects your uploads.</small>
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
                        {lyr.geomType || "Unknown"}{/* • {lyr.srid || "EPSG:4326"} */}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ),
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

            <div className="info-row" style={{ marginTop: 8 }}>
              <FiShield /> Organization layers are stored in your org workspace/namespace. Admins may promote or
              mirror layers into global “Base Layers” if requested.
            </div>
          </div>
        </div>
      ),
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
              <span>Link to a Lake (Your Org)</span>
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
              {/* TODO: populate from /api/org/lakes (org-owned/managed lakes) */}
            </select>

            <div className="info-row" style={{ marginTop: 8 }}>
              <FiInfo /> Geometry editing of lakes/watersheds/stations is handled on a dedicated page.
            </div>
          </div>
        </div>
      ),
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
                  placeholder="e.g., Org lake polygons"
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  value={data?.category || "Hydrology"}
                  onChange={(e) => setData({ ...data, category: e.target.value })}
                >
                  <option>Hydrology</option>
                  <option>Monitoring</option>
                  <option>Administrative</option>
                  <option>Boundaries</option>
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
                  value={data?.visibility || "org"}
                  onChange={(e) => setData({ ...data, visibility: e.target.value })}
                >
                  <option value="org">Organization (default)</option>
                  <option value="public">Public (requires admin approval)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Share with</label>
                <select
                  value={data?.shareScope || "members"}
                  onChange={(e) => setData({ ...data, shareScope: e.target.value })}
                >
                  <option value="members">Org Members</option>
                  <option value="managers">Org Managers Only</option>
                </select>
              </div>

              <div className="form-group">
                <label>Publish Strategy</label>
                <select value="overwrite" disabled>
                  <option value="overwrite">Overwrite existing (within org workspace)</option>
                </select>
              </div>
            </div>

            {data?.visibility === "public" && (
              <div className="alert-note" style={{ marginTop: 8 }}>
                <FiUsers /> Choosing <strong>Public</strong> will submit this layer for admin review. It will become
                visible on the public map after approval.
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
      initialData={{
        files: [],
        detectedLayers: [],       // to be populated by backend after upload
        selectedLayerIds: [],
        fixInvalidGeoms: true,
        lakeId: "",
        layerName: "",
        layerDesc: "",
        category: "Hydrology",
        visibility: "org",        // org by default
        shareScope: "members",    // org members by default
      }}
      labels={{
        back: "Back",
        next: "Next",
        finish: (data) => (data?.visibility === "public" ? "Submit for Approval" : "Publish to Org"),
      }}
      onFinish={(payload) => {
        // TODO:
        // - If payload.visibility === "public": POST /api/org/layers/submit-for-approval
        // - Else: POST /api/org/layers/publish
        console.log("Org layer publish/submit payload (scaffold):", payload);
        alert(
          payload.visibility === "public"
            ? "Submitted for admin approval (scaffold). Wire to backend when ready."
            : "Published to your org workspace (scaffold). Wire to backend when ready."
        );
      }}
    />
  );
}
